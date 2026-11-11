/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;

using Firely.Fhir.Packages;

using Hl7.Fhir.Introspection;
using Hl7.Fhir.Model;
using Hl7.Fhir.Specification;
using Hl7.Fhir.Specification.Source;
using Hl7.Fhir.Utility;

namespace Ignis.Codegen;

/// <summary>A folder of FHIR packages (<c>.tgz</c>) for one FHIR version.</summary>
public sealed class PackageFolder
{
    private const string PackageFilePattern = "*.tgz";

    // The release decides which version-specific elements the shared conformance classes map.
    private static readonly ConcurrentDictionary<FhirRelease, ModelInspector> ModelInspectorsByRelease = new();

    private PackageFolder(IReadOnlyList<string> packageFiles)
    {
        PackageFiles = packageFiles;
    }

    /// <summary>Sorted by name.</summary>
    public IReadOnlyList<string> PackageFiles { get; }

    public static PackageFolder Open(string directory)
    {
        var packageFiles = Directory.Exists(directory)
            ? Directory.GetFiles(directory, PackageFilePattern).OrderBy(file => file, StringComparer.Ordinal).ToArray()
            : [];
        if (packageFiles.Length == 0) throw new InvalidOperationException($"no .tgz packages in {directory}");
        return new PackageFolder(packageFiles);
    }

    /// <summary>Subfolders of <paramref name="root"/> with packages, else <paramref name="root"/> itself if it has any.</summary>
    public static IReadOnlyList<string> FindVersionFolders(string root)
    {
        if (!Directory.Exists(root)) return [];
        var subfoldersWithPackages = Directory.GetDirectories(root)
            .Where(HasPackages)
            .OrderBy(folder => folder, StringComparer.Ordinal)
            .ToArray();
        if (subfoldersWithPackages.Length > 0) return subfoldersWithPackages;
        return HasPackages(root) ? [root] : [];
    }

    /// <summary>Generates snapshots for differential-only definitions.</summary>
    public IAsyncResourceResolver CreateSnapshotResolver() => new SnapshotSource(OpenPackageSource());

    public async Task<IReadOnlyList<string>> ListResourceCanonicalsAsync()
    {
        var packageSource = OpenPackageSource();
        var canonicals = new List<string>();
        foreach (var uri in packageSource.ListResourceUris("StructureDefinition"))
        {
            if (await packageSource.ResolveByUriAsync(uri) is StructureDefinition { Url: not null } definition &&
                definition.IsResourceSpecialization())
                canonicals.Add(definition.Url);
        }
        canonicals.Sort(StringComparer.Ordinal);
        return canonicals;
    }

    /// <summary>Declared by the core package, else by the first package.</summary>
    public string? ReadFhirVersion()
    {
        var manifests = PackageFiles.Select(PackageManifest.TryRead).OfType<PackageManifest>().ToList();
        return (manifests.FirstOrDefault(manifest => manifest.IsCorePackage) ?? manifests.FirstOrDefault())?.FhirVersion;
    }

    /// <summary>Changes when a package is added, removed or replaced, or the generator is rebuilt.</summary>
    public string ComputeFingerprint()
    {
        var fingerprintSource = new StringBuilder(typeof(PackageFolder).Assembly.ManifestModule.ModuleVersionId.ToString());
        foreach (var file in PackageFiles)
            fingerprintSource.Append('\n').Append(Path.GetFileName(file)).Append(':').Append(new FileInfo(file).Length);
        return Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(fingerprintSource.ToString())));
    }

    private FhirRelease ReadFhirRelease()
    {
        var fhirVersion = ReadFhirVersion()
            ?? throw new InvalidOperationException($"no FHIR version declared in {Path.GetDirectoryName(PackageFiles[0])}");
        return FhirReleaseParser.TryParse(fhirVersion, out var release) && release is { } knownRelease
            ? knownRelease
            : throw new InvalidOperationException($"unsupported FHIR version {fhirVersion}");
    }

    private static bool HasPackages(string directory) => Directory.EnumerateFiles(directory, PackageFilePattern).Any();

    private static ModelInspector CreateModelInspector(FhirRelease release)
    {
        var inspector = new ModelInspector(release);
        inspector.Import(typeof(Base).Assembly);
        inspector.Import(typeof(StructureDefinition).Assembly);
        return inspector;
    }

    private FhirPackageSource OpenPackageSource() =>
        new(ModelInspectorsByRelease.GetOrAdd(ReadFhirRelease(), CreateModelInspector), PackageFiles.ToArray());
}
