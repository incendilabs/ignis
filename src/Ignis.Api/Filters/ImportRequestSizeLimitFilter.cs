/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using Ignis.Api.Configuration;

using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Options;

namespace Ignis.Api.Filters;

/// <summary>
/// Resource filter that overrides the request's max body size from
/// <see cref="ImportSettings.MaxUploadSizeBytes"/>. Runs before model
/// binding reads the body, so the limit applies to the upload itself.
/// </summary>
public sealed class ImportRequestSizeLimitFilter : IAsyncResourceFilter
{
    private readonly long _maxBytes;

    public ImportRequestSizeLimitFilter(IOptions<ImportSettings> options)
    {
        ArgumentNullException.ThrowIfNull(options);
        _maxBytes = options.Value.MaxUploadSizeBytes;
    }

    public Task OnResourceExecutionAsync(
        ResourceExecutingContext context,
        ResourceExecutionDelegate next)
    {
        var feature = context.HttpContext.Features.Get<IHttpMaxRequestBodySizeFeature>();
        if (feature is { IsReadOnly: false })
            feature.MaxRequestBodySize = _maxBytes;
        return next();
    }
}
