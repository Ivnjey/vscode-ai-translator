import axios from "axios";
import { workspace } from "vscode";
import { ITranslate, ITranslateOptions } from "comment-translate-manager";

const PREFIXCONFIG = "aiTranslator";

const langMaps: Map<string, string> = new Map([
  ["zh-CN", "ZH"],
  ["zh-TW", "ZH"],
]);

function convertLang(src: string) {
  if (langMaps.has(src)) {
    return langMaps.get(src);
  }
  return src.toLocaleUpperCase();
}

export function getConfig<T>(key: string): T | undefined {
  let configuration = workspace.getConfiguration(PREFIXCONFIG);
  return configuration.get<T>(key);
}

interface AITranslateOption {
  authKey?: string;
  apiAddress?: string;
  model?: string;
  systemPrompt?: string;
  userPrompt?: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
}

export class AITranslator implements ITranslate {
  get maxLen(): number {
    return 3000;
  }

  private _defaultOption: AITranslateOption;
  constructor() {
    this._defaultOption = this.createOption();
    workspace.onDidChangeConfiguration(async (eventNames) => {
      if (eventNames.affectsConfiguration(PREFIXCONFIG)) {
        this._defaultOption = this.createOption();
      }
    });
  }

  createOption() {
    const defaultOption: AITranslateOption = {
      authKey: getConfig<string>("authKey"),
      apiAddress: getConfig<string>("apiAddress"),
      model: getConfig<string>("model"),
      systemPrompt: getConfig<string>("systemPrompt"),
      userPrompt: getConfig<string>("userPrompt"),
      temperature: getConfig<number>("temperature"),
      max_tokens: getConfig<number>("max_tokens"),
      top_p: getConfig<number>("top_p"),
    };
    return defaultOption;
  }
  async translate(content: string, { to = "auto" }: ITranslateOptions) {
    const url = this._defaultOption.apiAddress;
    if (!this._defaultOption.authKey) {
      throw new Error("Please check the configuration of authKey!");
    }
    let systemPrompt = this._defaultOption.systemPrompt || `You are a professional translation engine in the IT field, do not translate noun phrases and programming domain terms, only return the translation result.`;
    let userPrompt = this._defaultOption.userPrompt ? `${this._defaultOption.userPrompt}${content}` : `${content}`;
    const body = {
      model: this._defaultOption.model,
      temperature: this._defaultOption.temperature ? this._defaultOption.temperature : 0.3,
      max_tokens: this._defaultOption.max_tokens ? this._defaultOption.max_tokens : 1200,
      top_p: this._defaultOption.top_p ? this._defaultOption.top_p : 1,
      frequency_penalty: 1,
      presence_penalty: 1,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
    };
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this._defaultOption.authKey}`,
    };

    let res = await axios.post(url, body, { headers });
    const { choices } = res.data;
    let targetTxt = choices[0].message.content;
    return targetTxt.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  }

  link(content: string, { to = "auto" }: ITranslateOptions) {
    let str = `${this._defaultOption.apiAddress}/${convertLang(to)}/${encodeURIComponent(content)}`;

    return `[AI](${str})`;
  }

  isSupported(src: string) {
    return true;
  }
}
