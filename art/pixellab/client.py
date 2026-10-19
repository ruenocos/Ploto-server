"""
A small PixelLab client (their MCP endpoint, JSON-RPC over HTTP).

The API key comes from the environment, never from the repo:

  export PIXELLAB_API_KEY=...        # or PIXELLAB_KEY_FILE=/path/to/file

Jobs are async: `submit()` returns a job id, `fetch()` returns the PNG bytes
once it has finished (None while it is still running).
"""
from __future__ import annotations

import base64
import json
import os
import time
import urllib.error
import urllib.request

URL = "https://api.pixellab.ai/mcp"


class Busy(Exception):
    """The plan's concurrent-job limit is reached; retry when a job finishes."""


def _key() -> str:
    key = os.environ.get("PIXELLAB_API_KEY")
    if not key and os.environ.get("PIXELLAB_KEY_FILE"):
        key = open(os.environ["PIXELLAB_KEY_FILE"]).read().strip()
    if not key:
        raise SystemExit("Set PIXELLAB_API_KEY (or PIXELLAB_KEY_FILE).")
    return key


class Client:
    def __init__(self) -> None:
        self.key = _key()
        self.session: str | None = None
        self._id = 0

    def _post(self, body: dict, timeout: int = 90) -> tuple[dict | None, dict]:
        headers = {"Authorization": f"Bearer {self.key}", "Content-Type": "application/json",
                   "Accept": "application/json, text/event-stream"}
        if self.session:
            headers["Mcp-Session-Id"] = self.session
        req = urllib.request.Request(URL, data=json.dumps(body).encode(), headers=headers)
        with urllib.request.urlopen(req, timeout=timeout) as res:
            raw = res.read().decode()
            hdrs = dict(res.headers)
        for line in raw.splitlines():  # streamable HTTP answers as server-sent events
            if line.startswith("data: "):
                return json.loads(line[6:]), hdrs
        return (json.loads(raw) if raw.strip() else None), hdrs

    def _open(self) -> None:
        _, hdrs = self._post({"jsonrpc": "2.0", "id": 0, "method": "initialize", "params": {
            "protocolVersion": "2025-03-26", "capabilities": {}, "clientInfo": {"name": "ploto-art", "version": "1"}}})
        self.session = next((v for k, v in hdrs.items() if k.lower() == "mcp-session-id"), None)
        self._post({"jsonrpc": "2.0", "method": "notifications/initialized"})

    def call(self, tool: str, args: dict) -> list[dict]:
        """Call a tool; returns its content blocks (text and images)."""
        for attempt in range(5):
            try:
                if not self.session:
                    self._open()
                self._id += 1
                res, _ = self._post({"jsonrpc": "2.0", "id": self._id, "method": "tools/call",
                                     "params": {"name": tool, "arguments": args}})
                if res and "error" in res:
                    raise RuntimeError(res["error"])
                return res["result"]["content"]
            except (urllib.error.URLError, ConnectionError, TimeoutError) as e:
                if getattr(e, "code", None) in (400, 404):
                    self.session = None  # the session expired: open a new one
                time.sleep(2 * 2 ** attempt)
        raise RuntimeError(f"{tool}: no answer after retries")

    def submit(self, tool: str, args: dict) -> str:
        text = self.call(tool, args)[0]["text"]
        if "rate limit" in text or "concurrent" in text.lower():
            raise Busy(text)
        try:
            data = json.loads(text)
            jid = data.get("job_id") or data.get("background_job_id")
        except ValueError:
            jid = next((l.split(":", 1)[1].strip() for l in text.splitlines() if l.startswith("job_id:")), None)
        if not jid:
            raise RuntimeError(f"{tool}: {text[:400]}")
        return jid

    def fetch(self, job_id: str) -> list[bytes] | None:
        """Every image of a finished job (an animation gives several), or None while it runs."""
        content = self.call("get_image", {"job_id": job_id})
        text = content[0].get("text", "")
        if text.startswith("status: processing") or text.startswith("status: pending") or "status: queued" in text:
            return None
        if "status: failed" in text or "error" in text.lower()[:200]:
            raise RuntimeError(f"job {job_id}: {text[:300]}")
        images = [base64.b64decode(c["data"]) for c in content if c["type"] == "image"]
        if not images:
            url = next((l.split(":", 1)[1].strip() for l in text.splitlines() if l.startswith("download:")), None)
            if url:
                images = [urllib.request.urlopen(url, timeout=60).read()]
        return images

    def balance(self) -> str:
        return self.call("get_balance", {})[0]["text"]
