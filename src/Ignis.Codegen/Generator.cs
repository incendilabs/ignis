/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using Ignis.Codegen.TypeScript;

namespace Ignis.Codegen;

/// <summary>What one run wrote for one package folder.</summary>
/// <param name="PackageNames">Package file names without <c>.tgz</c>.</param>
/// <param name="TypeCount">Interfaces for resources and datatypes, referenced ones included.</param>
/// <param name="UpToDate">Nothing was written; the counts are zero.</param>
public sealed record GenerationResult(
    string OutputDirectory,
    IReadOnlyList<string> PackageNames,
    int TypeCount,
    int ExtensionCount,
    IReadOnlyList<(string TypeNameOrCanonical, string Error)> Failures,
    bool UpToDate = false);

/// <summary>Writes TypeScript for a package folder.</summary>
public static class Generator
{
    private const string FingerprintFileName = ".stamp";

    public static Task<GenerationResult> GenerateAsync(string packagesDirectory, string outputDirectory, IReadOnlyList<string> typeNamesOrCanonicals) =>
        WriteAsync(PackageFolder.Open(packagesDirectory), outputDirectory, typeNamesOrCanonicals);

    /// <summary>Every resource in the folder; skipped when packages and generator are unchanged, unless forced.</summary>
    public static async Task<GenerationResult> GenerateAllAsync(string packagesDirectory, string outputDirectory, bool force)
    {
        var packageFolder = PackageFolder.Open(packagesDirectory);
        var fingerprint = packageFolder.ComputeFingerprint();
        var fingerprintFile = Path.Combine(outputDirectory, FingerprintFileName);
        if (!force && File.Exists(fingerprintFile) && File.ReadAllText(fingerprintFile) == fingerprint)
            return new GenerationResult(outputDirectory, PackageNames(packageFolder), 0, 0, [], UpToDate: true);

        var result = await WriteAsync(packageFolder, outputDirectory, await packageFolder.ListResourceCanonicalsAsync());
        if (result.Failures.Count == 0) await File.WriteAllTextAsync(fingerprintFile, fingerprint);
        return result;
    }

    private static async Task<GenerationResult> WriteAsync(PackageFolder packageFolder, string outputDirectory, IReadOnlyList<string> typeNamesOrCanonicals)
    {
        var emitter = new TypeScriptEmitter(packageFolder.CreateSnapshotResolver());
        var failures = new List<(string TypeNameOrCanonical, string Error)>();
        foreach (var typeNameOrCanonical in typeNamesOrCanonicals)
        {
            try
            {
                await emitter.AddDefinitionAsync(typeNameOrCanonical);
            }
            catch (Exception error) when (error is InvalidOperationException or NotSupportedException)
            {
                failures.Add((typeNameOrCanonical, error.Message));
            }
        }

        Directory.CreateDirectory(outputDirectory);
        foreach (var (fileName, fileContent) in emitter.RenderFiles(packageFolder.ReadFhirVersion()))
            await File.WriteAllTextAsync(Path.Combine(outputDirectory, fileName), fileContent);

        return new GenerationResult(outputDirectory, PackageNames(packageFolder), emitter.TypeCount, emitter.ExtensionCount, failures);
    }

    private static string[] PackageNames(PackageFolder packageFolder) =>
        packageFolder.PackageFiles.Select(Path.GetFileNameWithoutExtension).OfType<string>().ToArray();
}
