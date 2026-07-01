import { NextRequest, NextResponse } from 'next/server';

const API_KEY = process.env.OPENAI_API_KEY || '';
const BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const SYSTEM_PROMPT = `你是「AI密逃·无限轮回」的密室逃脱游戏主持人。玩家被困在一座神秘古堡中，需要解谜探索，集齐三件圣物才能逃脱。

## 核心规则

1. **回复格式**：每次回复必须严格使用以下JSON格式（不要包含其他任何文字）：
   {"text":"场景描述和AI回复","options":["选项1","选项2","选项3"],"status":"playing","inventoryChange":null,"lifeChange":0}

2. **text字段**：用第二人称描述当前场景，中文60-180字，沉浸感强，带哥特风氛围描写。

3. **options字段**：3-4个当前场景下合理的动作选项，只返回动作名如"查看书架"、"搜查书桌"等。玩家也可以自由输入其他动作。

4. **status字段**：
   - "playing" — 游戏进行中
   - "win" — 玩家集齐3件圣物（古堡印章、月光宝盒、灵魂宝石）并走出大门时
   - "lose" — 玩家生命归零时

5. **inventoryChange字段**：
   - 玩家拾取物品时返回物品名称（如"古堡印章"）
   - 未拾取物品时返回 null

6. **lifeChange字段**：
   - 玩家做出合理动作时返回 0
   - 玩家做出不合理/鲁莽动作（如"砸墙"、"跳窗"）时扣1，即返回 -1，同时 text 回复"此路不通"

## 游戏机制

- 初始场景：神秘古堡书房，烛光摇曳，书架林立
- 玩家初始生命：3条命（❤️❤️❤️）
- 三件圣物分散在古堡不同房间，需探索解谜获得
- 圣物1：古堡印章 — 书房书架的暗格中
- 圣物2：月光宝盒 — 塔楼顶层的窗台
- 圣物3：灵魂宝石 — 地下祭坛的雕像手中
- 合理探索靠近圣物时才触发拾取，不要自动给予
- 游戏风格：神秘、哥特、沉浸式`;

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    if (!API_KEY) {
      return NextResponse.json(
        { error: '请配置 OPENAI_API_KEY 环境变量' },
        { status: 500 }
      );
    }

    const apiMessages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: apiMessages,
        temperature: 0.7,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('API Error:', error);
      return NextResponse.json(
        { error: `AI API 调用失败: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // 尝试解析JSON，支持带```json标记的格式
    try {
      const cleaned = content
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();
      const parsed = JSON.parse(cleaned);

      return NextResponse.json({
        text: parsed.text || content,
        options: parsed.options || ['四处查看', '检查书架', '搜查书桌', '探索走廊'],
        status: parsed.status || 'playing',
        inventoryChange: parsed.inventoryChange || null,
        lifeChange: parsed.lifeChange || 0,
      });
    } catch {
      // JSON解析失败时返回兜底内容
      return NextResponse.json({
        text: content,
        options: ['四处查看', '检查书架', '搜查书桌', '探索走廊'],
        status: 'playing',
        inventoryChange: null,
        lifeChange: 0,
      });
    }
  } catch (error) {
    console.error('Server Error:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
