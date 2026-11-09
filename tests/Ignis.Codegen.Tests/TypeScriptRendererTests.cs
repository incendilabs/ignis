/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using FluentAssertions;

using Ignis.Codegen.TypeScript;

namespace Ignis.Codegen.Tests;

public sealed class TypeScriptRendererTests
{
    [Fact]
    public void String_literals_escape_quotes_and_backslashes_but_keep_non_ascii()
    {
        TypeScriptRenderer.StringLiteral("Extension.where(url = \"a\\b\")").Should().Be("\"Extension.where(url = \\\"a\\\\b\\\")\"");
        TypeScriptRenderer.StringLiteral("Mellomnavn æøå").Should().Be("\"Mellomnavn æøå\"");
    }

    [Fact]
    public void Doc_comments_cannot_be_closed_by_definition_text()
    {
        new CommentRenderer().Render(" Ends early */ here ").Should().Be("/** Ends early *\\/ here */\n");
        new CommentRenderer().Render("  ").Should().BeEmpty();
    }

    private sealed class CommentRenderer() : TypeScriptRenderer(typeCode => typeCode)
    {
        public string Render(string text)
        {
            AppendDocComment(indent: "", text);
            return Output.ToString();
        }
    }
}
