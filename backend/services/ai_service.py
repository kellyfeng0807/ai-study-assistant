"""
AI Service - DeepSeek API Integration & Qwen-VL Integration
"""

import os
import json
import re
from openai import OpenAI
from dashscope import MultiModalConversation

class AIService:
    def __init__(self):
        self.client = OpenAI(
            api_key=os.environ.get('DEEPSEEK_API_KEY'),
            base_url="https://api.deepseek.com"
        )
        self.dashscope_api_key = os.getenv("DASHSCOPE_API_KEY", "sk-52e14360ea034580a43eee057212de78")
    
    def generate_mindmap_mermaid(self, topic, depth=3, context='', style='TD'):
        """
        使用DeepSeek生成Mermaid思维导图代码
        style: 'TD' (top-down), 'LR' (left-right), 'radial' (radial/divergent)
        
        Temperature设置说明(官方推荐):
        - Data Cleaning/Data Analysis: 1.0 (思维导图生成属于数据分析类任务)
        - 需要在准确性和创造性之间取得平衡
        """
        # 根据样式设置不同的系统提示
        if style == 'radial':
            system_prompt = """You are a mind map generation assistant. Generate Mermaid MINDMAP syntax for radial mind maps.

CRITICAL: Use Mermaid's native mindmap syntax following official specification.

MINDMAP SYNTAX RULES (from https://mermaid.js.org/syntax/mindmap.html):
1. Start with 'mindmap' keyword
2. Root node: root((text)) - use circle shape
3. Shape options for child nodes:
   - Square brackets: [text]
   - Rounded: (text)
   - Circle: ((text))
   - Cloud: )text(
   - Hexagon: {{text}}
   - Bang: ))text((
   - Default: text
4. Indentation: Use exactly 2 spaces per level (strict)
5. Icons: ::icon(fa fa-icon-name) on same line after text
6. All siblings MUST be at exact same indentation

LABEL TEXT SAFETY RULES (CRITICAL to prevent parse errors):
- NO parentheses ( ) inside labels - they conflict with shape syntax
- NO square brackets [ ] inside labels - they conflict with shape syntax
- NO curly braces { } inside labels - they conflict with shape syntax
- NO special math symbols: π, ², ³, α, β, γ, θ, ∑, ∫, ≈, ≠, ≤, ≥
- NO punctuation that could be operators: <, >, ~, |, &, ^
- Use simple alternatives:
  * "power of 2" or "squared" instead of ²
  * "pi" instead of π
  * "theta" instead of θ
  * "approximately" instead of ≈
  * "not equal" instead of ≠
- For equations: use plain text like "E equals mc squared" or "z equals r times e to the i theta"
- Keep labels simple, descriptive, use common words
- If technical terms needed, use plain English/Chinese descriptions

STRUCTURE PRINCIPLES for balanced distribution:
- Root level: root((Topic))
- Level 1: 4-8 main branches using (Branch) or [Branch]
- Level 2: 2-4 items per branch
- Level 3: 1-3 items per level 2 item
- Keep branches balanced - similar number of children
- Use shape variety: alternate between (text) and [text] for level 1

EXAMPLE with proper structure:
mindmap
  root((Central Idea))
    (Branch Alpha)
      Item A1
      Item A2
      Item A3
    [Branch Beta]
      Item B1
      Item B2
    (Branch Gamma)
      Item C1
      Item C2
      Item C3
    [Branch Delta]
      Item D1
      Item D2

OUTPUT: Only mindmap code, no ```mermaid blocks, no explanations"""
        else:
            graph_direction = 'TD' if style == 'TD' else 'LR'
            system_prompt = f"""You are a mind map generation assistant. Generate Mermaid syntax for HIERARCHICAL mind maps.

CRITICAL SYNTAX RULES (must follow strictly to avoid parse errors):
1. Use 'graph {graph_direction}' for {'top-down' if style == 'TD' else 'left-right'} layout
2. Node IDs: Use only [A-Z][A-Z0-9]* (e.g., A, B1, C2, ROOT)
3. Node labels: Wrap in square brackets [Label Text]
4. Connections: Use --> between nodes (e.g., A --> B1)

LABEL TEXT SAFETY RULES (CRITICAL - most common source of parse errors):
**FORBIDDEN CHARACTERS in labels:**
- NO parentheses: ( )  - causes "Expecting 'SQE', got 'PS'" error
- NO square brackets: [ ]  - conflicts with label delimiters
- NO curly braces: {{ }}  - conflicts with special nodes
- NO angle brackets: < >  - reserved syntax
- NO pipes: |  - reserved for subgraphs
- NO quotes: " '  - can break string parsing
- NO backslashes: \  - escape character issues
- NO special math symbols: π, ², ³, α, β, γ, θ, φ, ω, Δ, ∑, ∫, √, ∞
- NO math operators in complex expressions: ^, ~, ≈, ≠, ≤, ≥, ±, ×, ÷
- NO semicolons or colons in complex contexts: ; :

**SAFE ALTERNATIVES:**
- Mathematical expressions:
  * "z = r e^(i theta)" → "z equals r times exponential of i theta"
  * "f(x) = x²" → "f of x equals x squared"
  * "∫ f(x) dx" → "integral of f x dx"
  * "Σ(n=1 to ∞)" → "sum from n equals 1 to infinity"
  * "θ₀ + 2kπ" → "theta-0 plus 2k pi"
  
- Use descriptive phrases:
  * Instead of "f(x)", use "function f of x" or "f-x"
  * Instead of "(a+b)²", use "a plus b squared"
  * Instead of "cos(θ)", use "cosine theta" or "cos-theta"
  
- For technical terms, use hyphens or underscores:
  * "euler_formula" instead of "Euler's formula (e^iθ)"
  * "complex-form" instead of "(a + bi)"
  * "nth-term" instead of "n-th term"

**SAFE CHARACTERS:**
- Letters: a-z, A-Z
- Numbers: 0-9
- Basic punctuation: . , ! ? (use sparingly)
- Separators: space, hyphen -, underscore _
- Safe operators in simple context: + - * / =

6. Format rules:
   - Each line: one node definition OR one connection
   - Node definition: NodeID[Label]
   - Connection: NodeID --> NodeID
   - No inline comments or extra text

7. Structure:
   - Define ALL nodes first (one per line)
   - Then define ALL connections (one per line)
   - OR define node and its connections together

EXAMPLE of CORRECT syntax:
graph {graph_direction}
    A[Central Topic]
    B1[Branch One]
    B2[Branch Two]
    C1[Detail 1]
    C2[Detail 2]
    A --> B1
    A --> B2
    B1 --> C1
    B1 --> C2

EXAMPLE with math content (SAFE):
graph {graph_direction}
    A[Complex Numbers]
    B1[Polar Form]
    B2[Exponential Form]
    C1[r times cosine theta plus i sine theta]
    C2[r times e to the i theta]
    A --> B1
    A --> B2
    B1 --> C1
    B2 --> C2

Rules for HIERARCHICAL style:
- Clear parent-child relationships
- Logical hierarchical structure
- Keep labels simple and readable
- Only output the Mermaid code, no explanations or markdown blocks"""

        # 处理depth参数
        if depth == 'auto' or depth == 'auto':
            depth_instruction = "Automatically determine the appropriate depth based on the topic complexity (typically 3-5 levels)"
        else:
            try:
                depth = int(depth)
                depth_instruction = f"Create exactly {depth} levels of hierarchy"
            except:
                depth = 3
                depth_instruction = "Create 3 levels of hierarchy"

        if style == 'radial':
            user_prompt = f"""Generate a RADIAL mind map using Mermaid's mindmap syntax for: "{topic}"

Style: Radial mindmap (refer to hierarchy style for similar visual appearance)
Depth: {depth_instruction}
{f'Additional context: {context}' if context else ''}

STRICT REQUIREMENTS:
- Use 'mindmap' syntax
- Root node: root(({topic}))
- Create 5-8 main branches from root
- Use alternating shapes for level 1: (Branch1), [Branch2], (Branch3), [Branch4], etc.
- Each main branch: 2-4 child items
- Each child item: 0-2 sub-items (if depth allows)
- CRITICAL: Use exactly 2 spaces for each indentation level
- Keep siblings at EXACT same indentation
- Balance branch sizes (similar number of children)
- Use concise labels (3-8 words max)

LABEL SAFETY (MOST IMPORTANT):
- NO parentheses ( ), brackets [ ], braces {{ }} in any label text
- NO mathematical symbols: π, ², ³, α, β, γ, θ, etc.
- For equations, use plain English: "x squared" not "x²", "theta" not "θ"
- Simple, clear, descriptive text only

EXAMPLE STRUCTURE:
mindmap
  root(({topic}))
    (Category A)
      Detail A1
      Detail A2
        Sub A2.1
    [Category B]
      Detail B1
      Detail B2
      Detail B3
    (Category C)
      Detail C1
      Detail C2

OUTPUT: Only the mindmap code, starting with 'mindmap'"""
        else:
            user_prompt = f"""Generate a HIERARCHICAL mind map in Mermaid syntax for: "{topic}"

Style: {'Top-Down' if style == 'TD' else 'Left-Right'} hierarchy
Depth: {depth_instruction}
{f'Additional context: {context}' if context else ''}

CRITICAL REQUIREMENTS to avoid syntax errors:
1. Start with 'graph {style}'
2. Node IDs: Simple alphanumeric only (A, B1, C2, ROOT, NODE1, etc.)
3. Labels in [square brackets]: Follow SAFETY RULES below

**LABEL SAFETY RULES (CRITICAL):**
- NEVER use parentheses ( ) - causes immediate parse error
- NEVER use square brackets [ ] - conflicts with label syntax
- NEVER use curly braces {{ }} - conflicts with special nodes
- NO mathematical symbols at all: π ² ³ α β γ θ φ ω Δ ∑ ∫ √ ∞
- NO complex punctuation: < > | & ~ ^ ` quotes

**For mathematical/technical content:**
- Use plain text descriptions
- Example: "z = re^i(theta0 + 2kpi)" → "z equals r e to the i theta"
- Example: "f(x) = x²" → "function f-x equals x squared"
- Example: "cos(θ)" → "cosine of theta" or "cos-theta"
- Use hyphens/underscores for compound terms: "euler-formula", "complex_number"

4. Structure:
   - Define nodes first: A[Label Text]
   - Then connections: A --> B
   - Clear hierarchy from general to specific
   
5. Keep labels concise (3-8 words) and readable
6. Each branch: 2-4 sub-nodes where appropriate

EXAMPLE FORMAT:
graph {style}
    ROOT[{topic}]
    A[Main Concept 1]
    B[Main Concept 2]
    ROOT --> A
    ROOT --> B
    A1[Detail 1.1]
    A2[Detail 1.2]
    A --> A1
    A --> A2

EXAMPLE with technical content:
graph {style}
    A[Complex Numbers]
    B[Polar Representation]
    C[r times e to the i theta]
    D[Euler Formula Connection]
    A --> B
    B --> C
    B --> D

OUTPUT: Only valid Mermaid code, no markdown blocks, no explanations"""

        try:
            response = self.client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                stream=False,
                temperature=1.0,
                max_tokens=2000
            )
            
            mermaid_code = response.choices[0].message.content.strip()
            
            # 清理代码块标记
            if mermaid_code.startswith('```mermaid'):
                mermaid_code = mermaid_code.replace('```mermaid', '').replace('```', '').strip()
            elif mermaid_code.startswith('```'):
                mermaid_code = mermaid_code.replace('```', '').strip()
            
            return mermaid_code
            
        except Exception as e:
            print(f"Error calling DeepSeek API: {e}")
            return self._generate_fallback_mindmap(topic, depth, style)
    
    def generate_mindmap_from_content(self, topic, file_content, depth=3, style='TD'):
        """
        根据文件内容生成思维导图
        """
        if style == 'radial':
            system_prompt = """You are a mind map generation assistant. Analyze content and create a RADIAL mind map using Mermaid's mindmap syntax.

Follow official Mermaid mindmap specification:
- Use 'mindmap' keyword
- Root: root((text)) with circle shape
- Level 1: Use (text) or [text] shapes alternately
- Exactly 2 spaces per indentation level
- Siblings at exact same indentation
- Balance branches (similar number of children)

LABEL SAFETY (CRITICAL):
- NO parentheses ( ), brackets [ ], braces {{ }} in label text
- NO mathematical symbols: π, ², ³, α, β, γ, θ, etc.
- NO operators that could conflict: <, >, |, &, ^
- Use plain English/Chinese descriptions for technical terms
- For equations: "x squared" not "x²", "pi" not "π", "theta" not "θ"

Focus on extracting key concepts and organizing them hierarchically."""
        else:
            graph_direction = 'TD' if style == 'TD' else 'LR'
            system_prompt = f"""You are a mind map generation assistant. Analyze the provided content and create a HIERARCHICAL mind map in Mermaid syntax using 'graph {graph_direction}'.

CRITICAL SYNTAX RULES to prevent parse errors:
1. Node IDs: Simple alphanumeric (A, B1, C2, ROOT)
2. Labels: Plain text only in [brackets]
3. Format: Define nodes, then connections
4. One statement per line

LABEL SAFETY RULES (MOST IMPORTANT):
**NEVER use these characters in labels:**
- Parentheses: ( )  - causes "Expecting 'SQE', got 'PS'" error
- Brackets: [ ]  - conflicts with label delimiters
- Braces: {{ }}  - conflicts with special syntax
- Math symbols: π, ², ³, α, β, γ, θ, φ, ω, Δ, ∑, ∫, √, ∞
- Operators: < > | & ~ ^ (except in simple contexts)
- Quotes: " '

**Use safe alternatives:**
- "f(x) = x²" → "function f-x equals x squared"
- "e^(iθ)" → "e to the i theta"
- "∫ f(x) dx" → "integral of f-x dx"
- "(a+b)²" → "a plus b squared"
- "θ₀" → "theta-0"

Focus on extracting key concepts, relationships, and hierarchies from the content."""

        # 处理depth参数
        if depth == 'auto' or depth == 'auto':
            depth_instruction = "Automatically determine the appropriate depth based on content complexity and richness"
        else:
            try:
                depth = int(depth)
                depth_instruction = f"Create exactly {depth} levels of hierarchy"
            except:
                depth = 3
                depth_instruction = "Create 3 levels of hierarchy"

        if style == 'radial':
            user_prompt = f"""Create a mind map using Mermaid's mindmap syntax for: "{topic}"

Based on this content:
{file_content[:2000]}

Style: Radial mindmap (refer to hierarchy for similar appearance)
Depth: {depth_instruction}

REQUIREMENTS:
- Extract main concepts from content
- Organize in mindmap structure: root((Topic))
- Use alternating shapes for level 1: (Branch), [Branch]
- Exactly 2 spaces per indentation
- 5-8 main branches with 2-4 children each
- Balance branch sizes

CRITICAL LABEL SAFETY:
- NO parentheses, brackets, or braces in any label
- NO mathematical symbols (π, ², ³, θ, α, etc.)
- Use plain descriptive text only
- For technical terms: use simple English/Chinese

OUTPUT: Only mindmap code, no markdown blocks"""
        else:
            user_prompt = f"""Create a mind map in Mermaid syntax for: "{topic}"

Based on this content:
{file_content[:2000]}

Style: {'Top-Down' if style == 'TD' else 'Left-Right'} hierarchy
Depth: {depth_instruction}

CRITICAL SYNTAX REQUIREMENTS:
- Start with 'graph {style}'
- Node IDs: Alphanumeric only (ROOT, A, B1, C2)
- Labels in [brackets]: Follow SAFETY rules

**LABEL SAFETY (MOST CRITICAL):**
- NEVER use parentheses ( ) in labels - causes parse error
- NEVER use brackets [ ] or braces {{ }} in labels
- NO math symbols: π, ², ³, α, β, γ, θ, etc.
- Use plain text alternatives:
  * "e^(iθ)" → "e to the i theta"
  * "f(x)" → "function f-x" or "f of x"
  * "x²" → "x squared"
  * Use hyphens for compound terms: "euler-formula"

- Define nodes, then connections
- Clear hierarchy structure
- Extract main ideas and organize {'top-down' if style == 'TD' else 'left-right'}

OUTPUT: Only valid Mermaid code, no markdown, no explanations"""

        try:
            response = self.client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                stream=False,
                temperature=1.0,
                max_tokens=2000
            )
            
            mermaid_code = response.choices[0].message.content.strip()
            
            # 清理代码块标记
            if mermaid_code.startswith('```mermaid'):
                mermaid_code = mermaid_code.replace('```mermaid', '').replace('```', '').strip()
            elif mermaid_code.startswith('```'):
                mermaid_code = mermaid_code.replace('```', '').strip()
            
            return mermaid_code
            
        except Exception as e:
            print(f"Error calling DeepSeek API: {e}")
            return self._generate_fallback_mindmap(topic, depth, style)
    
    def _generate_fallback_mindmap(self, topic, depth, style='TD'):
        """后备方案：生成基础思维导图"""
        if style == 'radial':
            # 使用原生 mindmap 语法，交替使用形状
            mermaid_code = f"""mindmap
  root(({topic}))
    (Core Concept 1)
      Key Point 1.1
      Key Point 1.2
      Key Point 1.3
    [Core Concept 2]
      Key Point 2.1
      Key Point 2.2
    (Core Concept 3)
      Key Point 3.1
      Key Point 3.2
      Key Point 3.3
    [Core Concept 4]
      Key Point 4.1
      Key Point 4.2
    (Core Concept 5)
      Key Point 5.1
      Key Point 5.2"""
            
            if depth >= 3:
                mermaid_code += """
        Detail 1.1.1
        Detail 1.1.2
        Detail 2.1.1"""
        else:
            # 层级型思维导图
            graph_dir = 'TD' if style == 'TD' else 'LR'
            mermaid_code = f"""graph {graph_dir}
    A[{topic}]
    """
            
            if depth >= 1:
                mermaid_code += """    A --> B1[Core Concept 1]
    A --> B2[Core Concept 2]
    A --> B3[Core Concept 3]
    """
            
            if depth >= 2:
                mermaid_code += """    B1 --> C1[Detail 1.1]
    B1 --> C2[Detail 1.2]
    B2 --> C3[Detail 2.1]
    B2 --> C4[Detail 2.2]
    B3 --> C5[Detail 3.1]
    """
            
            if depth >= 3:
                mermaid_code += """    C1 --> D1[Example 1.1.1]
    C2 --> D2[Example 1.2.1]
    C3 --> D3[Example 2.1.1]
    """
        
        return mermaid_code.strip()
    
    
    
    
    
    
    
    
    
    
    def chat(self, user_message, conversation_history=None):
        """
        处理聊天对话
        user_message: 用户消息
        conversation_history: 历史对话列表，格式 [{'role': 'user/assistant', 'content': '...'}]
        
        Temperature设置说明(官方推荐):
        - General Conversation: 1.3 (通用对话,需要更自然和多样化的回复)
        - Coding/Math: 0.0 (代码和数学需要精确性)
        - Data Cleaning/Analysis: 1.0 (数据分析需要平衡准确性和灵活性)
        """
        if conversation_history is None:
            conversation_history = []
        
        system_prompt = """You are a helpful AI study assistant. You help students with:
- Answering questions about their studies
- Explaining concepts clearly
- Providing learning guidance
- Helping with homework and assignments
- Organizing study materials

Be friendly, clear, and concise in your responses. Use LaTeX notation for mathematical formulas (e.g., $x^2$ for inline math, $$\\frac{a}{b}$$ for display math). Format your answers well for readability."""
        
        # 构建消息列表
        messages = [{"role": "system", "content": system_prompt}]
        
        # 添加历史对话（最多保留最近10轮对话以控制token和速度）
        if conversation_history:
            recent_history = conversation_history[-10:] if len(conversation_history) > 10 else conversation_history
            messages.extend(recent_history)
        
        # 添加当前用户消息
        messages.append({"role": "user", "content": user_message})
        
        try:
            response = self.client.chat.completions.create(
                model="deepseek-chat",
                messages=messages,
                stream=False,
                temperature=1.3,  # 通用对话推荐值,提供更自然和多样化的回复
                max_tokens=500
            )
            
            ai_response = response.choices[0].message.content.strip()
            return ai_response
            
        except Exception as e:
            print(f"Error calling DeepSeek chat API: {e}")
            raise Exception("Failed to get AI response")
    
    def generate_similar_questions(self, question_text, count=3, grade=None):
        """
        生成相似练习题
        
        Args:
            question_text: 原题文本
            count: 生成题目数量
            grade: 学生年级（可选），如 "Grade 7", "Grade 10" 等
            
        Returns:
            list: 相似题目列表，每个题目包含 question_text, correct_answer, subject, type, tags, analysis_steps
        """
        grade_info = f"\n- **学生年级**: {grade}，请确保题目难度适合该年级水平" if grade else ""
        
        prompt = f"""
你是一位资深中学教师，任务是根据以下原题生成 {{count}} 道"相似知识点、相似难度"的相似练习题，并为每道题提供标准答案。
{grade_info}

⚠️ 严格要求：
- 题目必须相似但不重复（改变数字、情境、表达方式、求解内容）
- 保持相似题型、科目、知识点
- 每道题包含：题目（question_text）和标准答案（correct_answer），科目，题目类型，知识点，分析步骤
- 科目（subject）从 Chinese, Mathematics, English, Physics, Chemistry, Politics, History, Geography, Biology 中选择。
- 不要出有图片的题目
- 只输出一个 JSON 数组，不要任何解释、注释或 Markdown
- 数组长度必须等于 {{count}}
- subject，type，tags用英语
- **原题题目是英语的就全部用英语**
- **输出的 JSON 必须是严格合法的，所有反斜杠必须双写（如 \\\\frac），确保能被 Python json.loads 直接解析。**

输出格式示例：
[
  {{
    "subject": "Mathematics",
    "type": "Single choice",
    "tags": ["Quadratic Equation", "Discriminant"],
    "question_text": "题目原文",
    "analysis_steps": ["步骤1", "步骤2"],
    "correct_answer": "标准答案"
  }}
]

原题如下：
=====================
{question_text}
=====================
"""
        
        try:
            response = self.client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "user", "content": prompt}
                ],
                stream=False,
                temperature=0.3,  # 数学/代码类任务需要精确性
                max_tokens=8000,
                response_format={"type": "json_object"}
            )
            
            raw_output = response.choices[0].message.content.strip()
            
            # 清理可能的 Markdown 代码块
            if raw_output.startswith('```json'):
                raw_output = raw_output.replace('```json', '').replace('```', '').strip()
            elif raw_output.startswith('```'):
                raw_output = raw_output.replace('```', '').strip()
            
            # 提取 JSON 对象
            import re
            start = raw_output.find('[')
            end = raw_output.rfind(']')
            if start != -1 and end > start:
                json_str = raw_output[start:end + 1]
            else:
                raise ValueError("No valid JSON array found in response")
            
            import json
            similar_list = json.loads(json_str)
            
            # 补齐或截断到指定数量
            similar_list = similar_list[:count]
            while len(similar_list) < count:
                similar_list.append({
                    "question_text": "（生成失败）",
                    "correct_answer": "",
                    "subject": "",
                    "type": "",
                    "tags": [],
                    "analysis_steps": []
                })
            
            return similar_list
            
        except Exception as e:
            print(f"Error generating similar questions: {e}")
            raise Exception(f"Failed to generate similar questions: {str(e)}")
    
    def judge_text_answer(self, question_text, user_answer, correct_answer=None):
        """
        判断文本答案是否正确
        
        Args:
            question_text: 题目文本
            user_answer: 用户答案
            correct_answer: 标准答案（可选）
            
        Returns:
            dict: {'is_correct': bool, 'reason': str}
        """
        prompt = f"""
You are a strict middle school teacher. Please judge whether the student's answer is correct.

Question:
{question_text}

'Standard Answer:
{correct_answer}

Accept simplified answers, such as numerical values or option letters.
Accept numerical answers without units; slightly imprecise but correct final answers are acceptable.

[Requirements]
1. First, solve the problem completely by yourself to obtain the correct answer.
2. Compare the student's answer with the correct answer, and use "is_correct" to indicate whether it is correct.
3. Output only pure JSON:
{{
    "reason": "Give me the step-by-step derivation process of the correct answer, one point per line",
    "is_correct": true or false
}}

Student's submitted answer:
{user_answer}
=====================
"""
        
        try:
            response = self.client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "user", "content": prompt}
                ],
                stream=False,
                temperature=0.0,  # 判分需要精确性
                max_tokens=1000
            )
            
            raw_output = response.choices[0].message.content.strip()
            
            # 清理可能的 Markdown 包裹
            if raw_output.startswith("```json"):
                raw_output = raw_output.split("```json", 1)[1].split("```", 1)[0]
            elif raw_output.startswith("```"):
                raw_output = raw_output.split("```", 1)[1].split("```", 1)[0]
            
            import json
            parsed = json.loads(raw_output.strip())
            
            
            return {
                'is_correct': bool(parsed.get("is_correct", False)),
                'reason': str(parsed.get("reason", "")).strip()
            }
            
        except Exception as e:
            print(f"Error judging answer: {e}")
            return {
                'is_correct': False,
                'reason': "AI 判定失败，默认判错"
            }

    def _clean_json_for_object(self, text: str) -> str:
        """从文本中提取 JSON（对象或数组），并修复 LaTeX 导致的非法转义"""
        text = text.strip()
        text = re.sub(r'^```(?:json)?\s*', '', text)
        text = re.sub(r'\s*```$', '', text)

        # 尝试提取数组
        start = text.find('[')
        end = text.rfind(']')
        if start != -1 and end > start:
            extracted = text[start:end + 1]
            # 关键修复：将所有 \ 转义为 \\，使 JSON 合法
            return extracted.replace('\\', '\\\\')

        # 尝试提取对象
        start = text.find('{')
        end = text.rfind('}')
        if start != -1 and end > start:
            extracted = text[start:end + 1]
            # 同样修复
            return extracted.replace('\\', '\\\\')

        raise ValueError("No valid JSON found")

    def ocr_and_parse_question(self, orig_path, cropped_results):
        """
        使用 Qwen-VL 识别题目图片并解析
        
        Args:
            orig_path: 原始图片路径
            cropped_results: 裁剪图片结果列表，每个元素包含 abs_path, bbox 等信息
            
        Returns:
            解析后的题目列表（已处理 JSON）
        """
        # 构建 prompt
        prompt = (
            "你是一位严谨的中学教师，请根据第一张图片识别题目内容、答案和解析。\n"
            "【图像说明】\n"
            "- 图像0：完整原题图片（包含题干、选项、答案等全部内容）\n"
            "- 图像1, 2, 3, ...：系统自动裁剪的局部图（如选项图、实验图、坐标系等）\n"
            "- 注意：**裁剪图的索引从 0 开始**，即：\n"
            "    • 图像1 → 裁剪图索引 0\n"
            "    • 图像2 → 裁剪图索引 1\n"
            "    • 图像3 → 裁剪图索引 2\n"
            "    • 以此类推\n"
            "\n"
            "**关键：为每道题指定它所依赖的裁剪图索引（crop_index）**\n"
            "   - crop_index 是一个整数列表，例如 [0], [1,2], [0,1,2,3,4,5] 或 []。\n"
            "   - **如果整张原图只包含一道题（无论多少小问），则该题必须包含所有裁剪图索引。**\n"
            "   - 仅当原图明确包含多道独立题目时，才可将裁剪图分配给不同题。\n"
            "   - 一道裁剪图只能属于一道题。\n"
            "\n"
            "1. 'question_text' 必须完整包含题目原文及所有选项。\n"
            "2. 只输出合法 JSON 数组，不要解释、Markdown 或额外文字。\n"
            "请严格输出 JSON 数组，只允许使用以下转义： \\\\, \\\", \\n, \\t, \\r,所有 LaTeX 公式中的反斜杠必须使用双反斜杠 \\\\，不要生成单反斜杠。"
            "3. 科目（subject）从 Chinese, Mathematics, English, Physics, Chemistry, Politics, History, Geography, Biology 中选择。\n"
            "4. 题型（type）、知识点（tags）使用英文描述。\n"
            "5. 'correct_answer' 和 'analysis_steps' 必须基于题目推导，与用户答案无关。\n"
            "6. 'user_answer' 为图片上的答案。\n"
            "请按以下格式输出示例：\n"
            "[\n"
            "  {\n"
            "    \"subject\": \"Chinese\",\n"
            "    \"type\": \"Constructed-response question\",\n"
            "    \"tags\": [\"Trigonometric Functions\",\"Induction Formulas\"],\n"
            "    \"question_text\": \"题目原文\",\n"
            "    \"analysis_steps\": [\"正确步骤1\",\"正确步骤2\"],\n"
            "    \"correct_answer\": \"正确答案\",\n"
            "    \"user_answer\": \"学生答案\",\n"
            "    \"crop_index\": []\n"
            "  },\n"
            "  {... 第二题 ...}\n"
            "]"
        )

        # 构建消息列表
        messages = [{
            "role": "user",
            "content": (
                [{"image": f"file://{os.path.abspath(orig_path)}"}] +
                [{"image": f"file://{crop['abs_path']}"} for crop in cropped_results] +
                [{"text": prompt}]
            )
        }]

        # 调用 Qwen-VL
        response = MultiModalConversation.call(
            model='qwen-vl-plus',
            messages=messages,
            api_key=self.dashscope_api_key,
            result_format='message'
        )

        if response.status_code != 200:
            raise Exception(f"Qwen-VL API Error {response.code}: {response.message}")

        raw_output = response.output.choices[0].message.content[0]['text']
        print("=== CLEANED JSON (repr) ===")
        print(repr(raw_output))
        print("=== END ===")

        cleaned_json = self._clean_json_for_object(raw_output)

        try:
            parsed_list = json.loads(cleaned_json)
        except json.JSONDecodeError as e:
            print("JSON 解析失败，启动修复模式…")
            print(e)

            repaired = cleaned_json
            # 尝试二次修复：去掉孤立反斜杠
            repaired = repaired.replace("\\'", "'")
            repaired = repaired.replace('\\"', '"')

            # 再试
            parsed_list = json.loads(repaired)

        if not isinstance(parsed_list, list):
            raise ValueError("模型返回的不是 JSON 数组，请检查输出格式。")

        return parsed_list

    def judge_redo_answer_with_image(self, question_text, correct_answer, image_path):
        """
        使用 Qwen-VL 判断重做答案（图片形式）
        
        Args:
            question_text: 题目文本
            correct_answer: 正确答案
            image_path: 用户答案图片路径
            
        Returns:
            dict: {'user_answer': str, 'is_correct': bool}
        """
        prompt = f"""
已知题目如下（文字形式提供，不需要识别图片中的题目）：
{question_text}

请严格完成以下任务：

1. **仅识别用户上传图片中的答案部分**（不要包含题目、解析、草稿等）。
2. **判断该答案是否与上述题目的学科和内容相关**：
   - 如果题目是生物/化学/历史等非数学题，但答案包含大量数学公式、方程、符号（如 x=, ∫, ∑, Δ 等），视为**无效答案**，判错。
   - 如果答案明显与题目主题无关（如题目问细胞结构，答案写"E=mc²"），判错。
3. **仅当图片中答案内容合理且与题目匹配时**，才进行正确性判断。
4. 输出必须是严格 JSON 格式，不要任何额外文字。

输出格式：
{{
  "user_answer": "识别出的图片中的答案原文，不是原题目的答案（保留原始格式，包括 LaTeX）",
  "is_correct": true 或 false
}}
"""

        messages = [{
            "role": "user",
            "content": [
                {"image": f"file://{os.path.abspath(image_path)}"},
                {"text": prompt}
            ]
        }]

        response = MultiModalConversation.call(
            model='qwen-vl-plus',
            messages=messages,
            api_key=self.dashscope_api_key,
            result_format='message'
        )

        raw_output = response.output.choices[0].message.content[0]['text']
        

        parsed = json.loads(self._clean_json_for_object(raw_output))
        
        
        return {
            'user_answer': parsed.get("user_answer", "").strip(),
            'is_correct': parsed.get("is_correct", False)
        }

    def judge_practice_answer_with_image(self, question_text, correct_answer, image_path):
        """
        使用 Qwen-VL 判断练习答案（图片形式）
        
        Args:
            question_text: 题目文本
            correct_answer: 正确答案
            image_path: 用户答案图片路径
            
        Returns:
            dict: {'user_answer': str, 'is_correct': bool}
        """
        prompt = f"""
已知题目如下：
{question_text}

请自己做一次题目，给出对应的过程和答案，然后识别用户上传图片中的答案，并判断是否正确。

输出 JSON:
{{
"correct_answer_and_analyse":"...",
    "user_answer": "...",
    "is_correct": true 或 false
}}
"""
        messages = [{
            "role": "user",
            "content": [
                {"image": f"file://{os.path.abspath(image_path)}"},
                {"text": prompt}
            ]
        }]

        response = MultiModalConversation.call(
            model='qwen-vl-plus',
            messages=messages,
            api_key=self.dashscope_api_key,
            result_format='message'
        )

        raw_output = response.output.choices[0].message.content[0]['text']
        parsed = json.loads(self._clean_json_for_object(raw_output))
        
        return {
            'user_answer': parsed.get("user_answer", "").strip(),
            'is_correct': parsed.get("is_correct", False)
        }

    def generate_note_from_text(self, text, subject='General'):
        """
        从文本生成结构化笔记
        
        Args:
            text: 输入文本（语音转文字或手动输入）
            subject: 科目名称
            
        Returns:
            dict: 包含 title, summary, key_points, examples, detailed_notes, tags
        """
        subject_instruction = f'Subject is: {subject}' if subject else 'Please identify the subject'
        
        prompt = f"""你是一名资深教师。请根据以下学习内容，生成一份结构化的学习笔记。

学习内容：
{text}

{subject_instruction}

请严格输出 JSON 格式，包含以下字段：
{{
  "title": "笔记标题（简洁明了）",
  "summary": "内容摘要（50-100字）",
  "key_points": ["关键点1", "关键点2", "关键点3"],
  "examples": ["示例1", "示例2"],
  "detailed_notes": "详细笔记内容（Markdown格式，包含标题、列表、重点等）",
  "tags": ["标签1", "标签2"]
}}

注意：
1. key_points 应提取最核心的3-5个要点
2. examples 如果有，提取1-3个代表性示例，如果没有可以为空数组
3. detailed_notes 使用 Markdown 格式，清晰分段
4. tags 应包含相关的知识点标签
5. 只输出 JSON，不要其他解释"""

        try:
            response = self.client.chat.completions.create(
                model="deepseek-chat",
                messages=[{"role": "user", "content": prompt}],
                stream=False,
                temperature=0.7,
                max_tokens=2000
            )
            
            raw_output = response.choices[0].message.content.strip()
            
            # 清理 Markdown 代码块
            if raw_output.startswith('```json'):
                raw_output = raw_output.replace('```json', '').replace('```', '').strip()
            elif raw_output.startswith('```'):
                raw_output = raw_output.replace('```', '').strip()
            
            parsed = json.loads(raw_output)
            
            return {
                'title': parsed.get('title', 'Untitled Note'),
                'summary': parsed.get('summary', ''),
                'key_points': parsed.get('key_points', []),
                'examples': parsed.get('examples', []),
                'detailed_notes': parsed.get('detailed_notes', text),
                'tags': parsed.get('tags', [])
            }
            
        except Exception as e:
            print(f"Error generating note: {e}")
            # 返回降级版本
            return self._fallback_note(text, subject)
    
    def _fallback_note(self, text, subject):
        """生成降级版笔记"""
        sentences = [s.strip() for s in text.split('。') if s.strip()]
        key_points = sentences[:min(3, len(sentences))]
        title = sentences[0][:15] + "..." if sentences else "Note"
        summary = text[:100] + "..." if len(text) > 100 else text
        
        return {
            'title': title,
            'summary': summary,
            'key_points': key_points,
            'examples': [],
            'detailed_notes': text,
            'tags': [subject, 'study note'] if subject and subject != 'General' else ['study note']
        }
    
    def ocr_image(self, image_path):
        """
        使用 Qwen-VL 识别图片中的文字
        
        Args:
            image_path: 图片文件绝对路径
            
        Returns:
            tuple: (text, error_message)
                - text: 识别出的文字内容，失败时为 None
                - error_message: 错误信息，成功时为 None
        """
        try:
            prompt = (
                "请仔细识别这张图片中的所有文字内容。\n"
                "要求：\n"
                "1. 完整提取所有可见文字\n"
                "2. 保持原有的段落结构\n"
                "3. 如果有标题、列表等，请保留格式\n"
                "4. 只输出识别到的文字内容，不要添加任何解释\n"
            )
            messages = [{
                "role": "user",
                "content": [
                    {"image": f"file://{os.path.abspath(image_path)}"},
                    {"text": prompt}
                ]
            }]
            
            response = MultiModalConversation.call(
                model='qwen-vl-plus',
                messages=messages,
                api_key=self.dashscope_api_key,
                result_format='message'
            )
            
            if response.status_code != 200:
                return None, f"OCR API Error {response.code}: {response.message}"
            
            text = response.output.choices[0].message.content[0]['text']
            return text.strip(), None
            
        except Exception as e:
            print(f"OCR failed: {e}")
            return None, f"图片OCR失败: {str(e)}"
    
    def speech_to_text(self, audio_data, language='auto'):
        """
        Speech to text using Xfyun ASR
        
        Args:
            audio_data: Raw PCM audio data (16kHz, mono, 16-bit)
            language: 'zh_cn' (Chinese), 'en_us' (English), or 'auto' (detect automatically)
        
        Returns:
            tuple: (recognized_text, error)
        """
        import logging
        
        # Auto-detection: try both languages and select best result
        if language == 'auto':
            logging.debug('Auto-detection mode: trying Chinese recognition...')
            text_zh, error_zh = self._recognize_xfyun(audio_data, 'zh_cn')
            zh_len = len(text_zh) if text_zh else 0
            logging.debug(f'Chinese result: {zh_len} characters')
            
            logging.debug('Trying English recognition...')
            text_en, error_en = self._recognize_xfyun(audio_data, 'en_us')
            en_len = len(text_en) if text_en else 0
            logging.debug(f'English result: {en_len} characters')
            
            if text_zh and text_en:
                # Calculate language confidence based on character composition
                en_letter_count = sum(1 for c in text_en if c.isalpha())
                en_ratio = en_letter_count / len(text_en) if text_en else 0
                
                zh_char_count = sum(1 for c in text_zh if '\u4e00' <= c <= '\u9fff')
                zh_ratio = zh_char_count / len(text_zh) if text_zh else 0
                
                logging.debug(f'Chinese ratio: {zh_ratio*100:.1f}%, English ratio: {en_ratio*100:.1f}%')
                
                if en_ratio > 0.6 and en_len > zh_len * 0.5:
                    logging.debug('Selecting English result')
                    return text_en, None
                else:
                    logging.debug('Selecting Chinese result')
                    return text_zh, None
            
            elif text_en:
                return text_en, None
            elif text_zh:
                return text_zh, None
            else:
                return None, error_zh or error_en or "Recognition failed"
        
        # Single language mode
        return self._recognize_xfyun(audio_data, language)
    
    def _recognize_xfyun(self, audio_data, language='zh_cn'):
        """Internal method: Recognize audio using Xfyun ASR."""
        import os
        
        # Get credentials from environment
        XFYUN_APPID = os.getenv('XFYUN_APPID', 'f047ebc8')
        XFYUN_API_SECRET = os.getenv('XFYUN_API_SECRET', 'M2MxZmM2MDdiYmYwNjlhYzFkNDdmOWZi')
        XFYUN_API_KEY = os.getenv('XFYUN_API_KEY', '014159c78a774f99e8e49946b4757daa')
        
        asr = _XfyunASRClient(audio_data, language, XFYUN_APPID, XFYUN_API_KEY, XFYUN_API_SECRET)
        return asr.recognize()


# Xfyun WebSocket ASR Client (Internal Class)
class _XfyunASRClient:
    """Xfyun WebSocket ASR Client - Internal implementation."""

    def __init__(self, audio_data, language, appid, api_key, api_secret):
        self.audio_data = audio_data
        self.language = language
        self.appid = appid
        self.api_key = api_key
        self.api_secret = api_secret
        self.result = []
        self.is_finished = False
        self.error = None

    def on_message(self, ws, message):
        import json
        try:
            data = json.loads(message)
            code = data.get("code")

            if code != 0:
                self.error = f"Xfyun Error {code}: {data.get('message', 'Unknown error')}"
                self.is_finished = True
                ws.close()
                return

            result_data = data.get("data", {})
            result = result_data.get("result", {})

            pgs = result.get("pgs", "")
            rg = result.get("rg", [])

            ws_list = result.get("ws", [])
            current_text = ""
            for ws_item in ws_list:
                cw_list = ws_item.get("cw", [])
                for cw in cw_list:
                    word = cw.get("w", "")
                    if word:
                        current_text += word

            if pgs == "rpl" and len(rg) == 2:
                start_idx = rg[0]
                end_idx = rg[1]
                if start_idx < len(self.result):
                    self.result = self.result[:start_idx]
                if current_text:
                    self.result.append(current_text)
            elif pgs == "apd" or not pgs:
                if current_text:
                    self.result.append(current_text)

            status = result_data.get("status")
            if status == 2:
                self.is_finished = True
                ws.close()

        except Exception as e:
            self.error = str(e)
            self.is_finished = True
            ws.close()

    def on_error(self, ws, error):
        self.error = str(error)
        self.is_finished = True

    def on_close(self, ws, close_status_code, close_msg):
        self.is_finished = True

    def on_open(self, ws):
        import threading
        import time
        import json
        import base64
        
        def send_audio():
            try:
                frame_size = 1280
                interval = 0.04

                status = 0
                offset = 0
                total_len = len(self.audio_data)

                while offset < total_len:
                    end = min(offset + frame_size, total_len)
                    chunk = self.audio_data[offset:end]

                    if offset == 0:
                        status = 0
                    elif end >= total_len:
                        status = 2
                    else:
                        status = 1

                    audio_base64 = base64.b64encode(chunk).decode('utf-8')

                    if status == 0:
                        message = {
                            "common": {"app_id": self.appid},
                            "business": {
                                "language": self.language,
                                "domain": "iat",
                                "accent": "mandarin",
                                "vad_eos": 3000,
                                "ptt": 1
                            },
                            "data": {
                                "status": status,
                                "format": "audio/L16;rate=16000",
                                "encoding": "raw",
                                "audio": audio_base64
                            }
                        }
                    else:
                        message = {
                            "data": {
                                "status": status,
                                "format": "audio/L16;rate=16000",
                                "encoding": "raw",
                                "audio": audio_base64
                            }
                        }

                    ws.send(json.dumps(message))
                    offset = end

                    if status != 2:
                        time.sleep(interval)

            except Exception as e:
                self.error = str(e)
                ws.close()

        threading.Thread(target=send_audio).start()

    def recognize(self):
        import websocket
        import time
        
        try:
            url = self._create_auth_url()

            ws = websocket.WebSocketApp(
                url,
                on_message=self.on_message,
                on_error=self.on_error,
                on_close=self.on_close,
                on_open=self.on_open
            )

            ws.run_forever()

            timeout = 60
            start_time = time.time()
            while not self.is_finished and (time.time() - start_time) < timeout:
                time.sleep(0.1)

            if self.error:
                return None, self.error

            return ''.join(self.result), None

        except Exception as e:
            return None, str(e)
    
    def _create_auth_url(self):
        """Create Xfyun WebSocket authentication URL."""
        import base64
        import hmac
        import hashlib
        from datetime import datetime
        from time import mktime
        from wsgiref.handlers import format_date_time
        from urllib.parse import urlencode

        now = datetime.now()
        date = format_date_time(mktime(now.timetuple()))

        signature_origin = f"host: ws-api.xfyun.cn\ndate: {date}\nGET /v2/iat HTTP/1.1"

        signature_sha = hmac.new(
            self.api_secret.encode('utf-8'),
            signature_origin.encode('utf-8'),
            digestmod=hashlib.sha256
        ).digest()

        signature_sha_base64 = base64.b64encode(signature_sha).decode('utf-8')

        authorization_origin = f'api_key="{self.api_key}", algorithm="hmac-sha256", headers="host date request-line", signature="{signature_sha_base64}"'
        authorization = base64.b64encode(authorization_origin.encode('utf-8')).decode('utf-8')

        params = {
            "authorization": authorization,
            "date": date,
            "host": "ws-api.xfyun.cn"
        }

        url = f"wss://ws-api.xfyun.cn/v2/iat?{urlencode(params)}"
        return url


# 创建单例实例
ai_service = AIService()
