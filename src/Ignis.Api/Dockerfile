FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS build
WORKDIR /src
COPY ["Ignis.Api.csproj", "./"]
RUN dotnet restore "Ignis.Api.csproj"
COPY . .
RUN dotnet publish "Ignis.Api.csproj" -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine
WORKDIR /app
RUN apk add --no-cache wget
COPY --chown=app:app --from=build /app/publish .
USER app
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
	CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1
ENTRYPOINT ["dotnet", "Ignis.Api.dll"]
