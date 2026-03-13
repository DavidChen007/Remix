
import { GoogleGenAI, Type } from "@google/genai";

const getAiClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const checkOKRQuality = async (objective: string, krs: string[]): Promise<string> => {
  const ai = getAiClient();
  const model = "gemini-3-flash-preview";
  const prompt = `
    作为战略管理专家，请检查以下 OKR 的设置质量：
    目标 (O): ${objective}
    关键结果 (KRs): ${krs.join('; ')}
    
    请根据 SMART 原则评估其“可衡量性”和“挑战性”，并给出具体的修改意见。
    如果包含模糊词汇（如“努力”、“加强”），请明确指出。
    返回 Markdown 格式。
  `;
  
  try {
    const response = await ai.models.generateContent({ model, contents: prompt });
    return response.text || "AI 检查暂时不可用";
  } catch (e) {
    return "检查失败，请检查网络连接";
  }
};

export const checkStrategyQuality = async (type: '使命' | '愿景', content: string): Promise<string> => {
  const ai = getAiClient();
  const model = "gemini-3-flash-preview";
  const prompt = `
    作为企业战略顾问，请对以下企业的${type}进行质量诊断：
    内容: "${content}"
    
    评估标准：
    1. 愿景是否具备前瞻性、感召力和清晰的方向感？
    2. 使命是否明确了组织存在的意义、业务领域及对客户的价值？
    请给出简明扼要的改进建议。
    返回 Markdown 格式。
  `;
  try {
    const response = await ai.models.generateContent({ model, contents: prompt });
    return response.text || "AI 检查暂时不可用";
  } catch (e) {
    return "检查失败";
  }
};

export const checkPADQuality = async (plan: string, action: string, deliverable: string): Promise<string> => {
  const ai = getAiClient();
  const model = "gemini-3-flash-preview";
  const prompt = `
    请审核以下周度 PAD 工作计划：
    计划 (Plan): ${plan}
    行动 (Action): ${action}
    交付物 (Deliverable): ${deliverable}
    
    分析计划与交付物是否匹配，行动是否能支撑目标的达成。给出一条具体改进建议。
  `;
  try {
    const response = await ai.models.generateContent({ model, contents: prompt });
    return response.text || "AI 检查暂时不可用";
  } catch (e) {
    return "检查失败";
  }
};
