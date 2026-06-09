# Build context: src/ (docker build -f src/Ignis.Api/Dockerfile src/)
FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine@sha256:5c559aa5d99337e400d39ab4fa1f6979d126c29b20939d53658ed38300571e74 AS build
WORKDIR /src
COPY Ignis.Api/Ignis.Api.csproj Ignis.Api/
COPY Ignis.Auth/Ignis.Auth.csproj Ignis.Auth/
RUN dotnet restore "Ignis.Api/Ignis.Api.csproj"
COPY . .
RUN dotnet publish "Ignis.Api/Ignis.Api.csproj" -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine@sha256:6327ae0927b5623617cf8437302e3f2700f01898e86bba60ec2e0971ce7c3add
WORKDIR /app
RUN apk add --no-cache wget
COPY --chown=app:app --from=build /app/publish .
USER app
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
	CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1
ENTRYPOINT ["dotnet", "Ignis.Api.dll"]
