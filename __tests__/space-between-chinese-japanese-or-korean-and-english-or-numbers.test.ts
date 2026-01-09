import SpaceBetweenChineseJapaneseOrKoreanAndEnglishOrNumbers from '../src/rules/space-between-chinese-japanese-or-korean-and-english-or-numbers';
import dedent from 'ts-dedent';
import {ruleTest} from './common';

ruleTest({
  RuleBuilderClass: SpaceBetweenChineseJapaneseOrKoreanAndEnglishOrNumbers,
  testCases: [
    {
      // accounts for https://github.com/platers/obsidian-linter/issues/303
      testName:
        'Make sure that spaces are added after a dollar sign if followed by Chinese characters',
      before: dedent`
        这是一个数学公式$f(x)=x^2$这是一个数学公式
      `,
      after: dedent`
        这是一个数学公式 $f(x)=x^2$ 这是一个数学公式
      `,
    },
    {
      // accounts for https://github.com/platers/obsidian-linter/issues/378
      testName: 'Make sure that inline code blocks are not affected',
      before: dedent`
        \`test\`
        \`test_case\`
        \`test_case_here\`
        \`test*case\`
        \`test*case*here\`
        \`测试\`
        \`测试_一下\`
        \`测试_一下_吧\`
        \`测试-几个-才行\`
        \`测试*一下\`
        \`测试*一下*你们\`
        \`测试一下**你们**所有人\`
        \`测试this case\`
        \`测试_this_case\`
        \`this_测试-还*可以\`
        \`filepath = './知识_巴别图书馆.md'\`
        \`テスト_ＴＥＳＴ\`
        \`filepath = './ちしき_図書館.md'\`
      `,
      after: dedent`
        \`test\`
        \`test_case\`
        \`test_case_here\`
        \`test*case\`
        \`test*case*here\`
        \`测试\`
        \`测试_一下\`
        \`测试_一下_吧\`
        \`测试-几个-才行\`
        \`测试*一下\`
        \`测试*一下*你们\`
        \`测试一下**你们**所有人\`
        \`测试this case\`
        \`测试_this_case\`
        \`this_测试-还*可以\`
        \`filepath = './知识_巴别图书馆.md'\`
        \`テスト_ＴＥＳＴ\`
        \`filepath = './ちしき_図書館.md'\`
      `,
    },
    { // accounts for https://github.com/platers/obsidian-linter/issues/407
      testName: 'Make sure that inline math blocks are not affected',
      before: dedent`
        # Title Here

        $M0 = 现金$
      `,
      after: dedent`
        # Title Here

        $M0 = 现金$
      `,
    },
    { // accounts for https://github.com/platers/obsidian-linter/issues/583
      testName: 'Make sure that wiki link and markdown links are ignored in italics',
      before: dedent`
        *[[abs 接口]]*
        *[abs 接口](abs 接口.md)*
      `,
      after: dedent`
        *[[abs 接口]]*
        *[abs 接口](abs 接口.md)*
      `,
    },
    { // relates for https://github.com/platers/obsidian-linter/issues/583
      testName: 'Make sure that wiki link and markdown links are ignored in bold',
      before: dedent`
        **[[abs 接口]]**
        **[abs 接口](abs 接口.md)**
      `,
      after: dedent`
        **[[abs 接口]]**
        **[abs 接口](abs 接口.md)**
      `,
    },
    { // accounts for https://github.com/platers/obsidian-linter/issues/662
      testName: 'Make sure that html is ignored',
      before: dedent`
        <img src="中文small.png" />
      `,
      after: dedent`
        <img src="中文small.png" />
      `,
    },
    { // accounts for https://github.com/platers/obsidian-linter/issues/667
      testName: 'Make sure that html elements do not affect the surrounding text',
      before: dedent`
        <u>自己想说的</u>
      `,
      after: dedent`
        <u>自己想说的</u>
      `,
    },
    { // accounts for https://github.com/platers/obsidian-linter/issues/681
      testName: 'Make sure that wiki links with their size specified are unaffected',
      before: dedent`
        ![[流浪地球-1.webp|image title|600]]
      `,
      after: dedent`
        ![[流浪地球-1.webp|image title|600]]
      `,
    },
    {
      testName: 'Make sure that wiki embed filenames are not modified',
      before: dedent`
        ![[视频或者image文件34有数字]]
        ![[完美网络42 [J0].mp4]]
      `,
      after: dedent`
        ![[视频或者image文件34有数字]]
        ![[完美网络42 [J0].mp4]]
      `,
    },
    { // accounts for https://github.com/platers/obsidian-linter/issues/1036
      testName: 'A dash can be removed from the characters to add space around for before and after CJK characters.',
      before: dedent`
        你好-世界
      `,
      after: dedent`
        你好-世界
      `,
      options: {
        englishNonLetterCharactersAfterCJKCharacters: `+'"([¥$`,
        englishNonLetterCharactersBeforeCJKCharacters: `+;:'"°%$)]`,
      },
    },
    {
      testName: 'Make sure that whitespace is removed from the value of punctuation or symbols and that an empty value does not cause issues',
      before: dedent`
        你好\t\t世界
        this测试-还
      `,
      after: dedent`
        你好\t\t世界
        this 测试-还
      `,
      options: {
        englishNonLetterCharactersAfterCJKCharacters: ``,
        englishNonLetterCharactersBeforeCJKCharacters: ` \t`,
      },
    },
  ],
});

describe('Space between CJK and English or numbers', () => {
  const rule = SpaceBetweenChineseJapaneseOrKoreanAndEnglishOrNumbers.getRule();

  it('handles line breaks between bold segments', () => {
    const before = dedent`
      香港的大学体系受英国影响，
      **教学岗位（Instructor）**与
      **学术科研岗位（Professor Track）**是
      **两条不同晋升路径**。
    `;
    const after = dedent`
      香港的大学体系受英国影响，
      **教学岗位（Instructor）** 与
      **学术科研岗位（Professor Track）** 是
      **两条不同晋升路径**。
    `;

    const once = rule.apply(before);
    expect(once).toBe(after);
    expect(rule.apply(once)).toBe(once);
  });

  it('handles line breaks inside bold segments', () => {
    const before = dedent`
      中文**教学岗位（Instructor）
      与English**中文。
    `;
    const after = dedent`
      中文**教学岗位（Instructor）
      与 English** 中文。
    `;

    const once = rule.apply(before);
    expect(once).toBe(after);
    expect(rule.apply(once)).toBe(once);
  });

  it('applies requested spacing around bold segments', () => {
    const before = dedent`
      然后 **锁在仓库里不给国民吃** 。

      1. **能用小钱搞定的事情不算事情**。

      你连**核磁共振成像（NMRI）**是什么原理都不知道？

      这是**尊重 STEM 开发者**的路线。

      难道**英文的括号 (english)**也要加空格吗？

      看起来其他符号也**" 可以 "**处理的吧。

      看起来其他符号也**“可以”**处理的吧。

      看起来其他符号也**「可以」**处理的吧。

      看起来其他符号也**【可以】**处理的吧。

      中文**教学english**与**学术english**是**两条 different 路径**。

      香港的大学体系受英国影响，**教学岗位（Instructor）**与**学术科研岗位（Professor Track）**是**两条不同晋升路径**。
    `;
    const after = dedent`
      然后**锁在仓库里不给国民吃**。

      1. **能用小钱搞定的事情不算事情**。

      你连**核磁共振成像（NMRI）** 是什么原理都不知道？

      这是**尊重 STEM 开发者**的路线。

      难道**英文的括号 (english)** 也要加空格吗？

      看起来其他符号也 **" 可以 "** 处理的吧。

      看起来其他符号也 **“可以”** 处理的吧。

      看起来其他符号也 **「可以」** 处理的吧。

      看起来其他符号也 **【可以】** 处理的吧。

      中文**教学 english** 与**学术 english** 是**两条 different 路径**。

      香港的大学体系受英国影响，**教学岗位（Instructor）** 与**学术科研岗位（Professor Track）** 是**两条不同晋升路径**。
    `;

    const once = rule.apply(before);
    expect(once).toBe(after);
    expect(rule.apply(once)).toBe(once);
  });

  it('restores emphasis placeholders when list markers are present', () => {
    const before = dedent`
      2.  **利用你的“Side Project”能力：**
          既然你擅长 Web、擅长 Rust，能不能把你的论文做成一个**“有着漂亮外壳的平庸内核”**？
          * 很多时候，评委或导师会被一个完善的**可视化界面（Web）**、一个**极其高效的推理引擎（Rust 重写）**或者一个**很有趣的交互 Demo**所迷惑。
          * 既然模型 SOTA 不了，那就把**性能**做到极致。在论文里大吹特吹你的系统架构、你的优化手段。这也是工作量，也能毕业。
    `;
    const after = dedent`
      2.  **利用你的“Side Project”能力：**
          既然你擅长 Web、擅长 Rust，能不能把你的论文做成一个 **“有着漂亮外壳的平庸内核”**？
          * 很多时候，评委或导师会被一个完善的**可视化界面（Web）**、一个**极其高效的推理引擎（Rust 重写）** 或者一个**很有趣的交互 Demo** 所迷惑。
          * 既然模型 SOTA 不了，那就把**性能**做到极致。在论文里大吹特吹你的系统架构、你的优化手段。这也是工作量，也能毕业。
    `;

    const once = rule.apply(before);
    expect(once).toBe(after);
    expect(rule.apply(once)).toBe(once);
  });

  it('does not match emphasis markers across blank lines', () => {
    const before = dedent`
      你要做的，是一个“特种武器供应商”**。

      - **你的角色**： 拥有 C++/AI/数据分析能力的“技术取证专家”。
    `;

    const once = rule.apply(before);
    expect(once).toBe(before);
    expect(rule.apply(once)).toBe(once);
  });
});
