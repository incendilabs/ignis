/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using System.Security.Claims;

using Ignis.Auth;

using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;

namespace Ignis.Api.Tests;

/// <summary>
/// Adds a <c>/test-login</c> endpoint that signs in as a test user
/// using the <see cref="AuthConstants.SessionScheme"/> cookie scheme.
/// </summary>
internal sealed class TestLoginStartupFilter : IStartupFilter
{
    public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next)
    {
        return app =>
        {
            app.Use(async (context, nextMiddleware) =>
            {
                if (context.Request.Path != "/test-login")
                {
                    await nextMiddleware();
                    return;
                }

                var claims = new List<Claim>
                {
                    new(ClaimTypes.NameIdentifier, "test-user-id"),
                    new(ClaimTypes.Name, "Test User"),
                };
                var identity = new ClaimsIdentity(claims, AuthConstants.SessionScheme);
                await context.SignInAsync(
                    AuthConstants.SessionScheme, new ClaimsPrincipal(identity));
                context.Response.StatusCode = StatusCodes.Status200OK;
            });
            next(app);
        };
    }
}
