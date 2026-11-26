import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { expect, it } from "vitest";
import { destinations, guides, packages } from "../data/siteData";
import { DestinationCard, GuideCard, PackageCard } from "./cards";

it("makes the whole destination card a single route link", () => {
  const html = renderToStaticMarkup(<MemoryRouter><DestinationCard destination={destinations[0]!} /></MemoryRouter>);
  expect(html.match(/<a\b/g)).toHaveLength(1);
  expect(html).toContain(`href="/destinations/${destinations[0]!.slug}"`);
  expect(html).toContain("hover:ring-4");
});

it("links the package card without nesting its save button and keeps the action on one line", () => {
  const html = renderToStaticMarkup(<MemoryRouter><PackageCard item={packages[0]!} /></MemoryRouter>);
  expect(html.match(/<a\b/g)).toHaveLength(1);
  expect(html).toContain('href="/packages"');
  expect(html).toContain(`aria-label="Save ${packages[0]!.title}"`);
  expect(html).toContain("whitespace-nowrap");
});

it("shows guide ratings to one decimal place", () => {
  const html = renderToStaticMarkup(<GuideCard guide={guides[0]!} />);
  expect(html).toContain("5.0");
  expect(html).not.toContain(guides[0]!.rating);
});
