# Third-party notices

## Monthly game lists

`public/archive.json` is generated from the monthly-game tables on the
[PlayStation Wiki](https://playstation.fandom.com/wiki/PlayStation_Plus)
(Fandom). Those pages are licensed under
[Creative Commons Attribution-ShareAlike 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

The pages used are the North America and PAL yearly lists (PlayStation Plus
monthly games through 2022, PlayStation Essential monthly games from 2023),
plus the single Asia and Japan monthly-game pages. Where a row cites a URL,
that URL is kept on the row. Most of those URLs are PlayStation Blog posts.

This project does not copy the wiki’s prose. It keeps the game name, the
PS4/PS5 marks, the dates, and the citation URL.

## Title IDs

Title IDs are copied from the Title-ID-Finder dataset in
[Robfreak/consolecheat-ex1](https://github.com/Robfreak/consolecheat-ex1)
(`cursor/title-id-finder-0ef2` at `d8264e5adf8e3806c6868623ca5a6aa1829d28a1`, `public/titles.json`). That file is generated
from [andshrew/PlayStation-Titles](https://github.com/andshrew/PlayStation-Titles),
which is MIT licensed:

Copyright (c) 2022 andshrew

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

An ID is included only when the wiki’s game name matches one name or alias in
that dataset exactly, after the same punctuation folding, and only for the
same region and platform. Near misses are left blank.

## Fonts

Outfit and Source Sans 3 are self-hosted from the
[@fontsource/outfit](https://fontsource.org/fonts/outfit) and
[@fontsource/source-sans-3](https://fontsource.org/fonts/source-sans-3)
packages. Both families are under the SIL Open Font License 1.1.
The page does not request Google Fonts or any other font host.
