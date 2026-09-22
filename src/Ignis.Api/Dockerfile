# Build context: repository root (docker build -f src/Ignis.Api/Dockerfile .)
FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine@sha256:3cc3bbbbf93d82104892f42aa9106b6be4d120346dea0649643a97c801525256 AS build
WORKDIR /src
COPY fhir-packages.targets ./
COPY src/Ignis.Api/Ignis.Api.csproj src/Ignis.Api/
COPY src/Ignis.Auth/Ignis.Auth.csproj src/Ignis.Auth/
COPY src/Ignis.Terminology/Ignis.Terminology.csproj src/Ignis.Terminology/
COPY src/Ignis.Validation/Ignis.Validation.csproj src/Ignis.Validation/
RUN dotnet restore "src/Ignis.Api/Ignis.Api.csproj" -p:Configuration=Release
COPY src ./src
RUN dotnet publish "src/Ignis.Api/Ignis.Api.csproj" -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine@sha256:f62a272ac1b46e83f56b8ed0416572f31cd1128e2c4a5e63eb34d348e4a36095
WORKDIR /app
RUN apk add --no-cache wget
COPY --chown=app:app --from=build /app/publish .
USER app
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1
ENTRYPOINT ["dotnet", "Ignis.Api.dll"]
