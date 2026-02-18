{{/*
Chart name, truncated to 63 chars.
*/}}
{{- define "ignis.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Fully qualified app name, truncated to 63 chars.
*/}}
{{- define "ignis.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Common labels.
*/}}
{{- define "ignis.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
MongoDB connection string.
Generates a connection string from db auth values or uses externalMongodbConnectionString.
*/}}
{{- define "ignis.mongodbConnectionString" -}}
{{- if .Values.db.enabled }}
{{- printf "mongodb://%s:%s@%s-mongodb:27017/%s?authSource=admin" (.Values.db.auth.username | urlquery) (.Values.db.auth.password | urlquery) (include "ignis.fullname" .) .Values.db.auth.database }}
{{- else }}
{{- if not .Values.app.api.externalMongodbConnectionString }}
{{- fail "app.api.externalMongodbConnectionString is required when db.enabled is false" }}
{{- end }}
{{- .Values.app.api.externalMongodbConnectionString }}
{{- end }}
{{- end }}
