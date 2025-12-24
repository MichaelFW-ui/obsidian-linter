import {Options, RuleType} from '../rules';
import RuleBuilder, {ExampleBuilder, OptionBuilderBase, TextOptionBuilder} from './rule-builder';
import dedent from 'ts-dedent';
import {IgnoreTypes} from '../utils/ignore-types';
import {getPositions, MDAstTypes, updateBoldText, updateItalicsText} from '../utils/mdast';
import {escapeRegExp} from '../utils/regex';

type TextRange = {
  start: number,
  end: number,
}

type EmphasisReplacement = {
  placeholder: string,
  value: string,
}

const emphasisSpacingTriggerRegex = /[()（）"“”「」【】]/;
const cjkCharRegex = /[\p{sc=Han}\p{sc=Katakana}\p{sc=Hiragana}\p{sc=Hangul}]/u;
const cjkPunctuationRegex = /[。！？；：、，]/;

function isEscaped(text: string, index: number): boolean {
  let backslashCount = 0;
  let cursor = index - 1;
  while (cursor >= 0 && text[cursor] === '\\') {
    backslashCount++;
    cursor--;
  }

  return backslashCount % 2 === 1;
}

function isExactMarkerRun(text: string, index: number, marker: string, length: number): boolean {
  if (text.substring(index, index + length) !== marker.repeat(length)) {
    return false;
  }

  const prevChar = index > 0 ? text[index - 1] : '';
  const nextChar = index + length < text.length ? text[index + length] : '';
  if (prevChar === marker || nextChar === marker) {
    return false;
  }

  return true;
}

function collectAsteriskEmphasisRanges(text: string, markerLength: number): TextRange[] {
  const ranges: TextRange[] = [];
  let openIndex: number = null;

  for (let index = 0; index <= text.length - markerLength; index++) {
    if (!isExactMarkerRun(text, index, '*', markerLength) || isEscaped(text, index)) {
      continue;
    }

    if (openIndex == null) {
      openIndex = index;
    } else {
      ranges.push({start: openIndex, end: index + markerLength});
      openIndex = null;
    }

    index += markerLength - 1;
  }

  return ranges;
}

function isCjkChar(char: string): boolean {
  return char !== '' && cjkCharRegex.test(char);
}

function isCjkPunctuation(char: string): boolean {
  return char !== '' && cjkPunctuationRegex.test(char);
}

function isEnglishOrNumberChar(char: string): boolean {
  return char !== '' && /[A-Za-z0-9]/.test(char);
}

function isEmphasisSpacingTrigger(char: string): boolean {
  return char !== '' && emphasisSpacingTriggerRegex.test(char);
}

function normalizeNonLetterCharacters(value?: string): string {
  if (!value) {
    return '';
  }

  return value.replaceAll(/\s/g, '');
}

function isEnglishLikeAfterCjk(char: string, englishAfterCjk: string): boolean {
  return isEnglishOrNumberChar(char) ||
    englishAfterCjk.includes(char) ||
    isEmphasisSpacingTrigger(char);
}

function isEnglishLikeBeforeCjk(char: string, englishBeforeCjk: string): boolean {
  return isEnglishOrNumberChar(char) ||
    englishBeforeCjk.includes(char) ||
    isEmphasisSpacingTrigger(char);
}

function isSpacingChar(char: string): boolean {
  return char === ' ' || char === '\t';
}

function isLineBreak(char: string): boolean {
  return char === '\n' || char === '\r';
}

function getFirstNonWhitespaceChar(text: string): string {
  for (const char of text) {
    if (!/\s/.test(char)) {
      return char;
    }
  }

  return '';
}

function getLastNonWhitespaceChar(text: string): string {
  for (let index = text.length - 1; index >= 0; index--) {
    const char = text[index];
    if (!/\s/.test(char)) {
      return char;
    }
  }

  return '';
}

function buildPlaceholder(index: number): string {
  return `{LINTEREMPHASISPLACEHOLDER${index}}`;
}

function replaceEmphasisRanges(
    text: string,
    ranges: TextRange[],
    markerLength: number,
    replacements: EmphasisReplacement[],
    placeholderIndex: number,
): {text: string, placeholderIndex: number} {
  if (ranges.length === 0) {
    return {text, placeholderIndex};
  }

  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const parts: string[] = [];
  let cursor = 0;

  for (const range of sorted) {
    if (range.start < cursor) {
      continue;
    }

    const value = text.substring(range.start, range.end);
    const placeholder = buildPlaceholder(placeholderIndex++);

    replacements.push({placeholder, value});
    parts.push(text.substring(cursor, range.start), placeholder);
    cursor = range.end;
  }

  parts.push(text.substring(cursor));
  return {text: parts.join(''), placeholderIndex};
}

function getUnderscoreEmphasisRanges(text: string, type: MDAstTypes, markerLength: number): TextRange[] {
  return getPositions(type, text).filter((position) => {
    if (position?.start?.offset == null || position?.end?.offset == null) {
      return false;
    }

    if (markerLength === 2) {
      return text.substring(position.start.offset, position.start.offset + 2) === '__' &&
        text.substring(position.end.offset - 2, position.end.offset) === '__';
    }

    return text.substring(position.start.offset, position.start.offset + 1) === '_' &&
      text.substring(position.end.offset - 1, position.end.offset) === '_';
  }).map((position) => ({start: position.start.offset, end: position.end.offset}));
}

function replaceEmphasisSegments(text: string): {text: string, replacements: EmphasisReplacement[]} {
  const replacements: EmphasisReplacement[] = [];
  let placeholderIndex = 0;
  let updatedText = text;

  const boldAsteriskRanges = collectAsteriskEmphasisRanges(updatedText, 2);
  ({text: updatedText, placeholderIndex} = replaceEmphasisRanges(
      updatedText,
      boldAsteriskRanges,
      2,
      replacements,
      placeholderIndex,
  ));

  const italicsAsteriskRanges = collectAsteriskEmphasisRanges(updatedText, 1);
  ({text: updatedText, placeholderIndex} = replaceEmphasisRanges(
      updatedText,
      italicsAsteriskRanges,
      1,
      replacements,
      placeholderIndex,
  ));

  const boldUnderscoreRanges = getUnderscoreEmphasisRanges(updatedText, MDAstTypes.Bold, 2);
  ({text: updatedText, placeholderIndex} = replaceEmphasisRanges(
      updatedText,
      boldUnderscoreRanges,
      2,
      replacements,
      placeholderIndex,
  ));

  const italicsUnderscoreRanges = getUnderscoreEmphasisRanges(updatedText, MDAstTypes.Italics, 1);
  ({text: updatedText, placeholderIndex} = replaceEmphasisRanges(
      updatedText,
      italicsUnderscoreRanges,
      1,
      replacements,
      placeholderIndex,
  ));

  return {text: updatedText, replacements};
}

function restoreEmphasisSegments(text: string, replacements: EmphasisReplacement[]): string {
  let updatedText = text;
  for (const replacement of replacements) {
    updatedText = updatedText.replace(replacement.placeholder, () => replacement.value);
  }

  return updatedText;
}

type EmphasisRangeWithMarker = TextRange & {
  markerLength: number,
}

function getBoldRanges(text: string): EmphasisRangeWithMarker[] {
  return [
    ...collectAsteriskEmphasisRanges(text, 2).map((range) => ({...range, markerLength: 2})),
    ...getUnderscoreEmphasisRanges(text, MDAstTypes.Bold, 2).map((range) => ({...range, markerLength: 2})),
  ];
}

function normalizeBoldSpacing(
    text: string,
    options: SpaceBetweenChineseJapaneseOrKoreanAndEnglishOrNumbersOptions,
): string {
  const englishAfterCjk = normalizeNonLetterCharacters(options.englishNonLetterCharactersAfterCJKCharacters);
  const englishBeforeCjk = normalizeNonLetterCharacters(options.englishNonLetterCharactersBeforeCJKCharacters);
  const ranges = getBoldRanges(text);

  if (ranges.length === 0) {
    return text;
  }

  const sorted = [...ranges].sort((a, b) => b.start - a.start);
  let updatedText = text;

  for (const range of sorted) {
    const innerText = updatedText.substring(range.start + range.markerLength, range.end - range.markerLength);
    const firstChar = getFirstNonWhitespaceChar(innerText);
    const lastChar = getLastNonWhitespaceChar(innerText);

    if (!firstChar || !lastChar) {
      continue;
    }

    let leftSpaceStart = range.start;
    let leftIndex = range.start - 1;
    while (leftIndex >= 0 && isSpacingChar(updatedText[leftIndex])) {
      leftSpaceStart = leftIndex;
      leftIndex--;
    }

    let rightIndex = range.end;
    while (rightIndex < updatedText.length && isSpacingChar(updatedText[rightIndex])) {
      rightIndex++;
    }

    const leftChar = leftIndex >= 0 ? updatedText[leftIndex] : '';
    const rightChar = rightIndex < updatedText.length ? updatedText[rightIndex] : '';
    const leftSpaces = updatedText.substring(leftSpaceStart, range.start);
    const rightSpaces = updatedText.substring(range.end, rightIndex);

    let newLeftSpaces = leftSpaces;
    let newRightSpaces = rightSpaces;

    if (leftChar && !isLineBreak(leftChar)) {
      const leftCharIsEnglishLike = isEnglishLikeBeforeCjk(leftChar, englishBeforeCjk);
      const firstCharIsCjk = isCjkChar(firstChar);
      const needsSpaceBefore = (isCjkChar(leftChar) && isEnglishLikeAfterCjk(firstChar, englishAfterCjk)) ||
        (leftCharIsEnglishLike && firstCharIsCjk);
      const shouldNormalizeLeft = isCjkChar(leftChar) || isCjkPunctuation(leftChar) || (leftCharIsEnglishLike && firstCharIsCjk);

      if (shouldNormalizeLeft) {
        newLeftSpaces = needsSpaceBefore ? ' ' : '';
      }
    }

    if (rightChar && !isLineBreak(rightChar)) {
      const rightCharIsCjkPunctuation = isCjkPunctuation(rightChar);
      const rightCharIsEnglishLike = isEnglishLikeAfterCjk(rightChar, englishAfterCjk);
      const needsSpaceAfter = !rightCharIsCjkPunctuation && (
        (isCjkChar(rightChar) && isEnglishLikeBeforeCjk(lastChar, englishBeforeCjk)) ||
        (rightCharIsEnglishLike && isCjkChar(lastChar))
      );
      const shouldNormalizeRight = isCjkChar(rightChar) || rightCharIsCjkPunctuation || (rightCharIsEnglishLike && isCjkChar(lastChar));

      if (shouldNormalizeRight) {
        newRightSpaces = needsSpaceAfter ? ' ' : '';
      }
    }

    if (newLeftSpaces === leftSpaces && newRightSpaces === rightSpaces) {
      continue;
    }

    const boldSegment = updatedText.substring(range.start, range.end);
    updatedText = updatedText.substring(0, leftSpaceStart) +
      newLeftSpaces +
      boldSegment +
      newRightSpaces +
      updatedText.substring(rightIndex);
  }

  return updatedText;
}

class SpaceBetweenChineseJapaneseOrKoreanAndEnglishOrNumbersOptions implements Options {
  englishNonLetterCharactersAfterCJKCharacters?: string = `-+'"([¥$`;
  englishNonLetterCharactersBeforeCJKCharacters?: string = `-+;:'"°%$)]`;
}

@RuleBuilder.register
export default class SpaceBetweenChineseJapaneseOrKoreanAndEnglishOrNumbers extends RuleBuilder<SpaceBetweenChineseJapaneseOrKoreanAndEnglishOrNumbersOptions> {
  constructor() {
    super({
      nameKey: 'rules.space-between-chinese-japanese-or-korean-and-english-or-numbers.name',
      descriptionKey: 'rules.space-between-chinese-japanese-or-korean-and-english-or-numbers.description',
      type: RuleType.SPACING,
      ruleIgnoreTypes: [IgnoreTypes.code, IgnoreTypes.inlineCode, IgnoreTypes.yaml, IgnoreTypes.image, IgnoreTypes.link, IgnoreTypes.wikiLink, IgnoreTypes.tag, IgnoreTypes.math, IgnoreTypes.inlineMath, IgnoreTypes.html],
    });
  }
  get OptionsClass(): new () => SpaceBetweenChineseJapaneseOrKoreanAndEnglishOrNumbersOptions {
    return SpaceBetweenChineseJapaneseOrKoreanAndEnglishOrNumbersOptions;
  }
  apply(
      text: string,
      options: SpaceBetweenChineseJapaneseOrKoreanAndEnglishOrNumbersOptions,
  ): string {
    const head = this.buildHeadRegex(options.englishNonLetterCharactersAfterCJKCharacters);
    const tail = this.buildTailRegex(options.englishNonLetterCharactersBeforeCJKCharacters);
    // inline math, inline code, markdown links, and wiki links are an exception in that even though they are to be ignored we want to keep a space around these types when surrounded by CJK characters
    const regexEscapedIgnoreExceptionPlaceHolders = `${IgnoreTypes.link.placeholder}|${IgnoreTypes.inlineMath.placeholder}|${IgnoreTypes.inlineCode.placeholder}|${IgnoreTypes.wikiLink.placeholder}`.replaceAll('{', '\\{').replaceAll('}', '\\}');
    const ignoreExceptionsHead = new RegExp(`(\\p{sc=Han}|\\p{sc=Katakana}|\\p{sc=Hiragana}|\\p{sc=Hangul})( *)(${regexEscapedIgnoreExceptionPlaceHolders})`, 'gmu');
    const ignoreExceptionsTail = new RegExp(`(${regexEscapedIgnoreExceptionPlaceHolders})( *)(\\p{sc=Han}|\\p{sc=Katakana}|\\p{sc=Hiragana}|\\p{sc=Hangul})`, 'gmu');
    const addSpaceAroundChineseJapaneseKoreanAndEnglish = function(text: string): string {
      return text.replace(head, '$1 $3').replace(tail, '$1 $3');
    };

    const emphasisReplacements = replaceEmphasisSegments(text);
    let newText = addSpaceAroundChineseJapaneseKoreanAndEnglish(emphasisReplacements.text);

    newText = newText.replace(ignoreExceptionsHead, '$1 $3').replace(ignoreExceptionsTail, '$1 $3');
    newText = restoreEmphasisSegments(newText, emphasisReplacements.replacements);
    newText = updateItalicsText(newText, addSpaceAroundChineseJapaneseKoreanAndEnglish);
    newText = updateBoldText(newText, addSpaceAroundChineseJapaneseKoreanAndEnglish);
    newText = normalizeBoldSpacing(newText, options);

    return newText;
  }
  buildHeadRegex(englishPunctuationAndSymbols: string): RegExp {
    if (englishPunctuationAndSymbols && englishPunctuationAndSymbols !== '') {
      // strip all whitespace
      englishPunctuationAndSymbols =englishPunctuationAndSymbols.replaceAll(/\s/g, '');
    }

    let puncAndSymbolGroup = '';
    if (englishPunctuationAndSymbols && englishPunctuationAndSymbols.length != 0) {
      puncAndSymbolGroup = `|[${escapeRegExp(englishPunctuationAndSymbols)}]`;
    }

    return new RegExp(`(\\p{sc=Han}|\\p{sc=Katakana}|\\p{sc=Hiragana}|\\p{sc=Hangul})( *)(\\[[^[]*\\]\\(.*\\)|\`[^\`]*\`|\\w+${puncAndSymbolGroup}|\\*[^*])`, 'gmu');
  }
  buildTailRegex(englishPunctuationAndSymbols: string): RegExp {
    if (englishPunctuationAndSymbols && englishPunctuationAndSymbols !== '') {
      // strip all whitespace
      englishPunctuationAndSymbols =englishPunctuationAndSymbols.replaceAll(/\s/g, '');
    }

    let puncAndSymbolGroup = '';
    if (englishPunctuationAndSymbols && englishPunctuationAndSymbols.length != 0) {
      puncAndSymbolGroup = `|[${escapeRegExp(englishPunctuationAndSymbols)}]`;
    }

    return new RegExp(`(\\[[^[]*\\]\\(.*\\)|\`[^\`]*\`|\\w+${puncAndSymbolGroup}|[^*]\\*)( *)(\\p{sc=Han}|\\p{sc=Katakana}|\\p{sc=Hiragana}|\\p{sc=Hangul})`, 'gmu');
  }
  get exampleBuilders(): ExampleBuilder<SpaceBetweenChineseJapaneseOrKoreanAndEnglishOrNumbersOptions>[] {
    return [
      new ExampleBuilder({
        description: 'Space between Chinese and English',
        before: dedent`
          中文字符串english中文字符串。
        `,
        after: dedent`
          中文字符串 english 中文字符串。
        `,
      }),
      new ExampleBuilder({
        description: 'Space between Chinese and link',
        before: dedent`
          中文字符串[english](http://example.com)中文字符串。
        `,
        after: dedent`
          中文字符串 [english](http://example.com) 中文字符串。
        `,
      }),
      new ExampleBuilder({
        description: 'Space between Chinese and inline code block',
        before: dedent`
          中文字符串\`code\`中文字符串。
        `,
        after: dedent`
          中文字符串 \`code\` 中文字符串。
        `,
      }),
      new ExampleBuilder({
        // accounts for https://github.com/platers/obsidian-linter/issues/234
        description: 'No space between Chinese and English in tag',
        before: dedent`
          #标签A #标签2标签
        `,
        after: dedent`
          #标签A #标签2标签
        `,
      }),
      new ExampleBuilder({
        // accounts for https://github.com/platers/obsidian-linter/issues/301
        description:
          'Make sure that spaces are not added between italics and chinese characters to preserve markdown syntax',
        before: dedent`
          _这是一个数学公式_
          *这是一个数学公式english*
          ${''}
          # Handling bold and italics nested in each other is not supported at this time
          ${''}
          **_这是一_个数学公式**
          *这是一hello__个数学world公式__*
        `,
        after: dedent`
          _这是一个数学公式_
          *这是一个数学公式 english*
          ${''}
          # Handling bold and italics nested in each other is not supported at this time
          ${''}
          **_ 这是一 _ 个数学公式**
          *这是一 hello__ 个数学 world 公式 __*
        `,
      }),
      new ExampleBuilder({
        // accounts for https://github.com/platers/obsidian-linter/issues/302
        description: 'Images and links are ignored',
        before: dedent`
          [[这是一个数学公式english]]
          ![[这是一个数学公式english.jpg]]
          [这是一个数学公式english](这是一个数学公式english.md)
          ![这是一个数学公式english](这是一个数学公式english.jpg)
        `,
        after: dedent`
          [[这是一个数学公式english]]
          ![[这是一个数学公式english.jpg]]
          [这是一个数学公式english](这是一个数学公式english.md)
          ![这是一个数学公式english](这是一个数学公式english.jpg)
        `,
      }),
      new ExampleBuilder({
        description: 'Space between CJK and English',
        before: dedent`
          日本語englishひらがな
          カタカナenglishカタカナ
          ﾊﾝｶｸｶﾀｶﾅenglish１２３全角数字
          한글english한글
        `,
        after: dedent`
          日本語 english ひらがな
          カタカナ english カタカナ
          ﾊﾝｶｸｶﾀｶﾅ english１２３全角数字
          한글 english 한글
        `,
      }),
    ];
  }
  get optionBuilders(): OptionBuilderBase<SpaceBetweenChineseJapaneseOrKoreanAndEnglishOrNumbersOptions>[] {
    return [
      new TextOptionBuilder({
        OptionsClass: SpaceBetweenChineseJapaneseOrKoreanAndEnglishOrNumbersOptions,
        nameKey: 'rules.space-between-chinese-japanese-or-korean-and-english-or-numbers.english-symbols-punctuation-before.name',
        descriptionKey: 'rules.space-between-chinese-japanese-or-korean-and-english-or-numbers.english-symbols-punctuation-before.description',
        optionsKey: 'englishNonLetterCharactersBeforeCJKCharacters',
      }),
      new TextOptionBuilder({
        OptionsClass: SpaceBetweenChineseJapaneseOrKoreanAndEnglishOrNumbersOptions,
        nameKey: 'rules.space-between-chinese-japanese-or-korean-and-english-or-numbers.english-symbols-punctuation-after.name',
        descriptionKey: 'rules.space-between-chinese-japanese-or-korean-and-english-or-numbers.english-symbols-punctuation-after.description',
        optionsKey: 'englishNonLetterCharactersAfterCJKCharacters',
      }),
    ];
  }
}
