# Commercial documents

Transaction proposals, valuations, cash models and NDA working files belong in
owner-controlled private storage, with named access approved by the document
owner. Keep engineering and operational documentation in this repository. Do not
add commercial document contents, private archive links, access credentials or
private counterpart names to public source, issues or pull requests.

REN-8 owns migration of the five historical commercial files. Verify the private
archive, checksums, historical versions and owner access before merging their
removal. Keep a restricted backup and preserve unrelated engineering/unmerged work.
The local ignore entries reduce accidental re-addition of these known paths;
reviewers must apply the same policy to renamed or newly created documents.

The existing pre-commit hook runs `node .github/check-public-documents.mjs` before
`lint-staged`; CI runs the same guard in the existing **Lint &
Type Check** job. The no-dependency check inspects the Git index and rejects the
five known historical commercial filenames plus
`RENEGADE-BUYER-INVESTMENT-SUMMARY.md` wherever they are tracked, including copies
moved into other directories. Matching ignores basename case and normalizes
Unicode/repeated whitespace. Local untracked files and textual references in
engineering documents do not fail this filename check. A Git inspection failure
fails closed. Run its isolated Git-repository regression tests with
`node --test .github/check-public-documents.test.mjs`.
Run the guard after staging and before committing or pushing. CI can reject a
merge, but it cannot prevent or undo exposure in a feature commit already pushed
to a public branch. Local hooks can be bypassed or absent; neither hooks nor CI
replace the document owner’s classification and review.

This safeguard checks known current-tree filenames only. It does not classify
semantic content, detect commercial text copied under a different basename, or
remove copies from history, tags, PR references, forks, caches or clones. Private
classification and human review remain necessary; passing CI is not evidence
that historical exposure has been remediated.

Removing current files does not remove prior public commits, tags, PR references,
forks or clones. Any history rewrite or GitHub cache/reference remediation requires
a separate owner-approved plan preserving release-baseline provenance. Document
which copies remain public.

Production remains under the existing release process. A main merge automatically
deploys production; a documentation cleanup does not authorize changing deployment
controls or advancing main.
