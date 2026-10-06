/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

namespace Ignis.Auth;

public static class AuthConstants
{
    /// <summary>
    /// Authentication scheme used for the user session cookie during the authorization code flow.
    /// </summary>
    public const string SessionScheme = "IgnisAuth.Session";

    /// <summary>
    /// MongoDB collection holding the ASP.NET Core Data Protection key ring, so cookies
    /// protected before a restart (or by another replica) can still be decrypted.
    /// </summary>
    public const string DataProtectionKeysCollection = "DataProtectionKeys";

    /// <summary>
    /// Data Protection application discriminator. Fixed so every instance shares one key ring
    /// regardless of content root path.
    /// </summary>
    public const string DataProtectionApplicationName = "Ignis";
}
