{{/*
Fullname for API resources.
*/}}
{{- define "app.api.fullname" -}}
{{- printf "%s-api" .Release.Name | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels for API.
*/}}
{{- define "app.api.labels" -}}
{{ include "app.api.selectorLabels" . }}
app.kubernetes.io/component: api
app.kubernetes.io/part-of: ignis
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels for API.
*/}}
{{- define "app.api.selectorLabels" -}}
app.kubernetes.io/name: ignis-api
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Fullname for Web resources.
*/}}
{{- define "app.web.fullname" -}}
{{- printf "%s-web" .Release.Name | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels for Web.
*/}}
{{- define "app.web.labels" -}}
{{ include "app.web.selectorLabels" . }}
app.kubernetes.io/component: web
app.kubernetes.io/part-of: ignis
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels for Web.
*/}}
{{- define "app.web.selectorLabels" -}}
app.kubernetes.io/name: ignis-web
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
