# Open Issues - Event Slideshow Template Editor

## 1. Template storage boundary

Should the template document live in DynamoDB, S3, or a hybrid model?

Recommendation: keep the template data in a structured event-scoped document and store binary assets in S3.

## 2. Svelte Flow integration cost

Svelte Flow adds an external editor dependency and may increase the admin bundle size.

Recommendation: use it only on the dedicated design page so the impact stays isolated.

## 3. Asset limits

We need an explicit limit for decorative asset count, layer count, and file size.

Recommendation: enforce a conservative cap up front so slideshow rendering stays reliable on low-power TV browsers.

## 4. Published vs draft behavior

The editor needs a clear rule for when changes become visible on the live slideshow.

Recommendation: keep draft edits private until the admin publishes them.
