/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using System.Net;
using System.Text;

using Ignis.Auth;

namespace Ignis.Api.Services.Auth;

/// <summary>
/// Renders the HTML page shown to a user who hits /connect/login with multiple
/// external providers configured. The page lists one button per provider and
/// sends the chosen one back to the login endpoint as ?provider=...
/// </summary>
public static class LoginPageRenderer
{
    public static string RenderProviderSelection(
        IReadOnlyList<ExternalProviderSettings> providers,
        string returnUrl)
    {
        var encodedReturnUrl = WebUtility.UrlEncode(returnUrl);
        var buttons = new StringBuilder();
        foreach (var p in providers)
        {
            var displayName = WebUtility.HtmlEncode(p.Name);
            var encodedName = WebUtility.UrlEncode(p.Name);
            buttons.Append("      <a href=\"?provider=")
                   .Append(encodedName)
                   .Append("&amp;returnUrl=")
                   .Append(encodedReturnUrl)
                   .Append("\">Continue with ")
                   .Append(displayName)
                   .Append("</a>\n");
        }

        return $$"""
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <title>Sign in</title>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif; max-width: 24rem; margin: 4rem auto; padding: 1rem; color: #111; }
                h1 { font-size: 1.25rem; margin: 0 0 1.5rem; }
                a { display: block; padding: 0.75rem 1rem; margin: 0.5rem 0; background: #111; color: #fff; text-decoration: none; border-radius: 4px; text-align: center; }
                a:hover { opacity: 0.9; }
                a:focus { outline: 2px solid #0066ff; outline-offset: 2px; }
              </style>
            </head>
            <body>
              <h1>Sign in</h1>
            {{buttons.ToString().TrimEnd('\n')}}
            </body>
            </html>
            """;
    }
}
