/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using System.Formats.Tar;
using System.IO.Compression;
using System.Text.Json;

namespace Ignis.Codegen;

internal sealed record PackageManifest(string Name, string? FhirVersion)
{
    private const string ManifestEntryName = "package/package.json";

    // Current packages list fhirVersions; the R4 core package (tools-version 3) uses fhir-version-list.
    private static readonly string[] FhirVersionListProperties = ["fhirVersions", "fhir-version-list"];

    public bool IsCorePackage => Name.EndsWith(".core", StringComparison.Ordinal);

    public static PackageManifest? TryRead(string packageFile)
    {
        using var file = File.OpenRead(packageFile);
        using var gzip = new GZipStream(file, CompressionMode.Decompress);
        using var tar = new TarReader(gzip);
        while (tar.GetNextEntry() is { } entry)
        {
            if (entry.Name != ManifestEntryName || entry.DataStream is null) continue;
            using var json = JsonDocument.Parse(entry.DataStream);
            return new PackageManifest(ReadName(json.RootElement), ReadFirstFhirVersion(json.RootElement));
        }
        return null;
    }

    private static string ReadName(JsonElement manifest) =>
        manifest.TryGetProperty("name", out var name) ? name.GetString() ?? "" : "";

    private static string? ReadFirstFhirVersion(JsonElement manifest)
    {
        foreach (var property in FhirVersionListProperties)
        {
            if (manifest.TryGetProperty(property, out var versions) &&
                versions.ValueKind == JsonValueKind.Array &&
                versions.GetArrayLength() > 0)
                return versions[0].GetString();
        }
        return null;
    }
}
