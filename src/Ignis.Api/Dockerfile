# Build context: repository root (docker build -f src/Ignis.Api/Dockerfile .)
FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine@sha256:d8ee39817ca03a3757288e83c37ed73cc969a286c603b827c7cbe33add1c2d1c AS build
WORKDIR /src
COPY fhir-packages.targets ./
COPY src/Ignis.Api/Ignis.Api.csproj src/Ignis.Api/
COPY src/Ignis.Auth/Ignis.Auth.csproj src/Ignis.Auth/
COPY src/Ignis.Terminology/Ignis.Terminology.csproj src/Ignis.Terminology/
COPY src/Ignis.Validation/Ignis.Validation.csproj src/Ignis.Validation/
RUN dotnet restore "src/Ignis.Api/Ignis.Api.csproj" -p:Configuration=Release
COPY src ./src
RUN dotnet publish "src/Ignis.Api/Ignis.Api.csproj" -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine@sha256:27b6b84beeede74fd16886177d360799c8e4299ceadfbd64eef57bafead7878a
WORKDIR /app
RUN apk add --no-cache wget
COPY --chown=app:app --from=build /app/publish .
USER app
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1
ENTRYPOINT ["dotnet", "Ignis.Api.dll"]
