# Security Policy

## Supported versions

`ricdom` is currently pre-1.0 (`2.0.0-alpha`, not yet published to npm). Security fixes
land on the latest `2.x` release only — there is no long-term-support branch at this
stage.

The predecessor project, [RicDOM v1](https://github.com/miyoshi-tec/RicDOM)
(`miyoshi-tec/RicDOM`, versions `0.x`/`0.4.x`), is in maintenance mode. Security reports
against v1 are still accepted; see that repository, or report via the same contact below.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for a suspected security vulnerability.

Email **info@miyoshi-seisakusyo.jp** with:

- A description of the issue and its potential impact.
- Steps to reproduce, ideally as a minimal standalone HTML file using the IIFE build (see
  [CONTRIBUTING.md](CONTRIBUTING.md) for why a minimal repro matters — it applies here
  too).
- The `ricdom` version (or commit) affected, and your runtime environment if relevant
  (browser/Electron version, OS).

You should expect an acknowledgement within a few business days. Please allow time for a
fix to be prepared and released before any public disclosure.

## Scope

`ricdom`'s trust boundary is the code you write with it — the library does not fetch
remote content, execute arbitrary strings as code (`eval`/`new Function`), or manage
credentials/network requests on its own. Reports involving supply-chain issues in the
package itself (e.g. a compromised published artifact) are in scope; reports about how a
specific application built with `ricdom` handles user input are generally an application
concern, not a library one, but are still welcome if you believe the library's API design
makes a common mistake unusually easy to make.
