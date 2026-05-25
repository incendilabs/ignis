# Build context: src/ (docker build -f src/Ignis.Api/Dockerfile src/)
FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine@sha256:5c559aa5d99337e400d39ab4fa1f6979d126c29b20939d53658ed38300571e74 AS build
WORKDIR /src
COPY Ignis.Api/Ignis.Api.csproj Ignis.Api/
COPY Ignis.Auth/Ignis.Auth.csproj Ignis.Auth/
RUN dotnet restore "Ignis.Api/Ignis.Api.csproj"
COPY . .
RUN dotnet publish "Ignis.Api/Ignis.Api.csproj" -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine@sha256:1e37a8236c558ae31bd6bc8144e38e6036b73cf1b0616fe56d79e60babb9d93b
WORKDIR /app
RUN apk add --no-cache wget
COPY --chown=app:app --from=build /app/publish .
USER app
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
	CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1
ENTRYPOINT ["dotnet", "Ignis.Api.dll"]
