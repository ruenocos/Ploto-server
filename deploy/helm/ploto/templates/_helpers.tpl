{{- define "ploto.fullname" -}}
{{- if contains .Chart.Name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name .Chart.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "ploto.labels" -}}
app.kubernetes.io/name: {{ .Chart.Name }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version }}
{{- end -}}

{{- define "ploto.selectorLabels" -}}
app.kubernetes.io/name: {{ .Chart.Name }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "ploto.tlsSecret" -}}
{{- default (printf "%s-tls" (include "ploto.fullname" .)) .Values.tls.secretName -}}
{{- end -}}

{{- define "ploto.statsSecret" -}}
{{- default (printf "%s-stats" (include "ploto.fullname" .)) .Values.statsKey.existingSecret -}}
{{- end -}}

{{/* The Gateway the routes attach to, plus which listener for https / http. */}}
{{- define "ploto.parentRef" -}}
{{- $ctx := index . 0 -}}{{- $listener := index . 1 -}}
{{- if $ctx.Values.gateway.create }}
- name: {{ include "ploto.fullname" $ctx }}
  sectionName: {{ $listener }}
{{- else }}
- name: {{ required "gateway.existing.name is required when gateway.create=false" $ctx.Values.gateway.existing.name }}
  {{- with $ctx.Values.gateway.existing.namespace }}
  namespace: {{ . }}
  {{- end }}
  sectionName: {{ ternary $ctx.Values.gateway.existing.httpsSectionName $ctx.Values.gateway.existing.httpSectionName (eq $listener "https") }}
{{- end }}
{{- end -}}
