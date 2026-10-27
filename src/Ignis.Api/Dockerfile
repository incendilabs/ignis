# Build context: repository root (docker build -f src/Ignis.Api/Dockerfile .)
FROM --platform=$BUILDPLATFORM mcr.microsoft.com/dotnet/sdk:10.0-alpine@sha256:cc02b814237a76c4735fb6eeee87181597b5e56f2ce458a435e527674d91f4d7 AS build
ARG TARGETARCH
WORKDIR /src
COPY Directory.Build.props fhir-packages.targets ./
COPY src/Ignis.Api/Ignis.Api.csproj src/Ignis.Api/
COPY src/Ignis.Auth/Ignis.Auth.csproj src/Ignis.Auth/
COPY src/Ignis.Terminology/Ignis.Terminology.csproj src/Ignis.Terminology/
COPY src/Ignis.Validation/Ignis.Validation.csproj src/Ignis.Validation/
RUN dotnet restore "src/Ignis.Api/Ignis.Api.csproj" -a $TARGETARCH -p:Configuration=Release
COPY src ./src
RUN dotnet publish "src/Ignis.Api/Ignis.Api.csproj" -c Release -a $TARGETARCH -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine@sha256:254fe017495996d3abcc487ffacdcce2b73affb380d3af87af12c8dff41fe0b0
WORKDIR /app
RUN apk add --no-cache wget
COPY --chown=app:app --from=build /app/publish .
USER app
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1
ENTRYPOINT ["dotnet", "Ignis.Api.dll"]
