"""
AI Service - DeepSeek API Integration
"""

import os
from openai import OpenAI

class AIService:
    def __init__(self):
        self.client = OpenAI(
            api_key=os.environ.get('DEEPSEEK_API_KEY'),
            base_url="https://api.deepseek.com"
        )
    
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
            # TD (top-down) or LR (left-right) hierarchical
            graph_direction = 'TD' if style == 'TD' else 'LR'
            system_prompt = f"""You are a mind map generation assistant. Generate Mermaid syntax for HIERARCHICAL mind maps.
Rules for HIERARCHICAL style:
1. Use 'graph {graph_direction}' for {'top-down' if style == 'TD' else 'left-right'} layout
2. Clear parent-child relationships
3. Logical hierarchical structure
4. Use proper Mermaid syntax: A[Label], A --> B
5. Only output the Mermaid code, no explanations"""

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

Requirements:
- Start with 'graph {style}'
- Clear hierarchical structure from general to specific
- {depth_instruction}
- Each branch should have 2-4 sub-nodes where appropriate
- Use descriptive but concise labels
- Output only valid Mermaid code"""

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
Focus on extracting key concepts and organizing them hierarchically."""
        else:
            graph_direction = 'TD' if style == 'TD' else 'LR'
            system_prompt = f"""You are a mind map generation assistant. Analyze the provided content and create a HIERARCHICAL mind map in Mermaid syntax using 'graph {graph_direction}'.
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
- Output only mindmap code"""
        else:
            user_prompt = f"""Create a mind map in Mermaid syntax for: "{topic}"

Based on this content:
{file_content[:2000]}

Style: {'Top-Down' if style == 'TD' else 'Left-Right'} hierarchy
Depth: {depth_instruction}

Extract the main ideas and organize them {'in a top-down' if style == 'TD' else 'in a left-right'} hierarchy. Output only valid Mermaid code."""

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
            return self._generate_fallback_mindmap(topic, depth)
    
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

# 创建单例实例
ai_service = AIService()
