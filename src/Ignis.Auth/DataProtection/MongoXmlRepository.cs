/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using System.Xml.Linq;

using Microsoft.AspNetCore.DataProtection.Repositories;

using MongoDB.Bson;
using MongoDB.Driver;

namespace Ignis.Auth.DataProtection;

/// <summary>
/// Stores the Data Protection key ring in MongoDB. Keys are only ever added; Data Protection
/// expires old keys itself, so nothing is updated or deleted here.
/// </summary>
internal sealed class MongoXmlRepository : IXmlRepository
{
    private readonly IMongoCollection<DataProtectionKeyDocument> _collection;

    public MongoXmlRepository(IMongoCollection<DataProtectionKeyDocument> collection) =>
        _collection = collection;

    // IXmlRepository is synchronous, hence the driver's sync API.
    public IReadOnlyCollection<XElement> GetAllElements() =>
        _collection.Find(FilterDefinition<DataProtectionKeyDocument>.Empty)
            .ToList()
            .Select(document => XElement.Parse(document.Xml))
            .ToList()
            .AsReadOnly();

    public void StoreElement(XElement element, string friendlyName) =>
        _collection.InsertOne(new DataProtectionKeyDocument
        {
            FriendlyName = friendlyName,
            Xml = element.ToString(SaveOptions.DisableFormatting),
        });
}

internal sealed class DataProtectionKeyDocument
{
    public ObjectId Id { get; set; }
    public string FriendlyName { get; set; } = "";
    public string Xml { get; set; } = "";
}
