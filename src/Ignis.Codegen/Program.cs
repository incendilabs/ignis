/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using Ignis.Codegen;

const int ExitCodeFailed = 1;
const int ExitCodeUsage = 2;
const string Usage = """
    usage:
      --packages <dir> --out <dir> [--force]                   every resource; one subfolder of <dir> per FHIR version
      --packages <dir> --out <dir> <type name or canonical>... the given definitions from a single package folder
    """;

string? packagesDirectory = null;
string? outputDirectory = null;
var force = false;
var typeNamesOrCanonicals = new List<string>();

for (var i = 0; i < args.Length; i++)
{
    switch (args[i])
    {
        case "--packages": packagesDirectory = args[++i]; break;
        case "--out": outputDirectory = args[++i]; break;
        case "--force": force = true; break;
        default: typeNamesOrCanonicals.Add(args[i]); break;
    }
}

if (packagesDirectory is null || outputDirectory is null)
{
    Console.Error.WriteLine(Usage);
    return ExitCodeUsage;
}

if (typeNamesOrCanonicals.Count > 0)
{
    Console.WriteLine($"Generating {typeNamesOrCanonicals.Count} definitions from {packagesDirectory}");
    var result = await Generator.GenerateAsync(packagesDirectory, outputDirectory, typeNamesOrCanonicals);
    PrintResult(result);
    return result.Failures.Count > 0 ? ExitCodeFailed : 0;
}

var versionFolders = PackageFolder.FindVersionFolders(packagesDirectory);
if (versionFolders.Count == 0)
{
    Console.Error.WriteLine($"no package folders under {packagesDirectory}");
    return ExitCodeUsage;
}

var versionNames = string.Join(", ", versionFolders.Select(Path.GetFileName));
Console.WriteLine($"Generating TypeScript for {versionNames} from {packagesDirectory}");

var anyFailed = false;
foreach (var versionFolder in versionFolders)
{
    var versionOutputDirectory = Path.Combine(outputDirectory, Path.GetFileName(versionFolder));
    var result = await Generator.GenerateAllAsync(versionFolder, versionOutputDirectory, force);
    PrintResult(result);
    anyFailed |= result.Failures.Count > 0;
}
return anyFailed ? ExitCodeFailed : 0;

static void PrintResult(GenerationResult result)
{
    Console.WriteLine($"{string.Join(", ", result.PackageNames)} -> {result.OutputDirectory}");
    Console.WriteLine(result.UpToDate
        ? "  up to date"
        : $"  {result.TypeCount} types, {result.ExtensionCount} extensions, {result.Failures.Count} failed");
    foreach (var (typeNameOrCanonical, error) in result.Failures)
        Console.Error.WriteLine($"  FAILED {typeNameOrCanonical}: {error}");
}
