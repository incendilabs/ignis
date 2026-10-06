/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using System.Xml.Linq;

using FluentAssertions;

using Ignis.Auth;
using Ignis.Auth.DataProtection;

using MongoDB.Driver;

namespace Ignis.Api.Tests;

[Collection("IntegrationTests")]
public class MongoXmlRepositoryTests
{
    private readonly IMongoCollection<DataProtectionKeyDocument> _collection;

    public MongoXmlRepositoryTests(MongoContainerFixture mongo)
    {
        var connectionString = mongo.ConnectionStringForDatabase("ignis_dpkeys_" + Guid.NewGuid().ToString("N"));
        _collection = new MongoClient(connectionString)
            .GetDatabase(MongoUrl.Create(connectionString).DatabaseName)
            .GetCollection<DataProtectionKeyDocument>(AuthConstants.DataProtectionKeysCollection);
    }

    [Fact]
    public void GetAllElements_WhenEmpty_ReturnsNothing()
    {
        new MongoXmlRepository(_collection).GetAllElements().Should().BeEmpty();
    }

    [Fact]
    public void StoreElement_RoundTripsEveryElement()
    {
        var repository = new MongoXmlRepository(_collection);
        var first = XElement.Parse("""<key id="1"><value>one</value></key>""");
        var second = XElement.Parse("""<key id="2"><value>two</value></key>""");

        repository.StoreElement(first, "key-1");
        repository.StoreElement(second, "key-2");

        var elements = new MongoXmlRepository(_collection).GetAllElements();
        elements.Select(e => e.ToString()).Should().BeEquivalentTo([first.ToString(), second.ToString()]);
        _collection.Find(FilterDefinition<DataProtectionKeyDocument>.Empty).ToList(cancellationToken: TestContext.Current.CancellationToken).Select(d => d.FriendlyName).Should().BeEquivalentTo(["key-1", "key-2"]);
    }
}
