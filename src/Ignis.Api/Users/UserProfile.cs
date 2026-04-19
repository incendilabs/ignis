/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

namespace Ignis.Api.Users;

public record UserProfile(
    string Subject,
    string? Name,
    string? Email,
    string? AvatarUrl,
    string[] Scopes);
