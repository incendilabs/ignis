{{/*
Fullname for MongoDB resources.
*/}}
{{- define "db.fullname" -}}
{{- printf "%s-mongodb" .Release.Name | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels for MongoDB.
*/}}
{{- define "db.labels" -}}
{{ include "db.selectorLabels" . }}
app.kubernetes.io/component: database
app.kubernetes.io/part-of: ignis
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels for MongoDB.
*/}}
{{- define "db.selectorLabels" -}}
app.kubernetes.io/name: ignis-mongodb
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
MongoDB secret name.
*/}}
{{- define "db.secretName" -}}
{{- if .Values.auth.existingSecret }}
{{- .Values.auth.existingSecret }}
{{- else }}
{{- include "db.fullname" . }}
{{- end }}
{{- end }}
