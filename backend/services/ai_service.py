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
        """
        # 根据样式设置不同的系统提示
        if style == 'radial':
            system_prompt = """You are a mind map generation assistant. Generate Mermaid syntax for RADIAL/DIVERGENT mind maps with DISTRIBUTED SPATIAL LAYOUT.

CRITICAL RULES for RADIAL style to utilize full canvas width:
1. Use 'graph LR' (LEFT-RIGHT) as base direction for MAXIMUM horizontal spread
2. Create a STAR/RADIAL pattern with branches spreading in different directions
3. Use subgraphs or careful node placement to distribute branches around the center
4. STAGGER branches at different horizontal and vertical levels to avoid crowding
5. Create 4-6 PRIMARY branches from center, each taking different spatial positions
6. For each primary branch, add 2-3 sub-branches that extend OUTWARD
7. AVOID placing all same-level nodes on the same line - distribute them spatially
8. Use proper Mermaid syntax: A[Label], A --> B
9. Only output the Mermaid code, no explanations

SPATIAL DISTRIBUTION STRATEGY:
- Top branches: Extend upward-right and upward-left
- Middle branches: Extend horizontally left and right
- Bottom branches: Extend downward-right and downward-left
- Use node IDs that suggest position (TL=top-left, TR=top-right, ML=middle-left, MR=middle-right, BL=bottom-left, BR=bottom-right)

Example pattern for WIDE radial distribution:
graph LR
    Center[Main Topic]
    
    Center --> TR1[Top-Right Concept 1]
    Center --> MR1[Middle-Right Concept 2]
    Center --> BR1[Bottom-Right Concept 3]
    Center --> BL1[Bottom-Left Concept 4]
    Center --> ML1[Middle-Left Concept 5]
    Center --> TL1[Top-Left Concept 6]
    
    TR1 --> TR2[Detail R1]
    TR1 --> TR3[Detail R2]
    
    MR1 --> MR2[Detail R3]
    
    BR1 --> BR2[Detail R4]
    BR1 --> BR3[Detail R5]
    
    BL1 --> BL2[Detail L1]
    
    ML1 --> ML2[Detail L2]
    ML1 --> ML3[Detail L3]
    
    TL1 --> TL2[Detail L4]"""
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
            user_prompt = f"""Generate a RADIAL/DIVERGENT mind map in Mermaid syntax for: "{topic}"

Style: Radial with WIDE spatial distribution (use graph LR for maximum horizontal spread)
Depth: {depth_instruction}
{f'Additional context: {context}' if context else ''}

CRITICAL Requirements for WIDE LAYOUT:
- Use 'graph LR' for horizontal orientation
- Create 4-6 primary branches from center, positioned in different spatial areas (top-right, middle-right, bottom-right, bottom-left, middle-left, top-left)
- STAGGER branches vertically and horizontally - DO NOT place same-level nodes on same line
- Each primary branch has 2-3 sub-branches extending OUTWARD from their position
- Use node IDs indicating position (TR, MR, BR, BL, ML, TL for direction)
- Distribute nodes to utilize FULL canvas width and height
- Use descriptive but concise labels
- Output only valid Mermaid code starting with 'graph LR'"""
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
                temperature=0.7,
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
            # 返回基础的思维导图作为后备
            return self._generate_fallback_mindmap(topic, depth)
    
    def generate_mindmap_from_content(self, topic, file_content, depth=3, style='TD'):
        """
        根据文件内容生成思维导图
        """
        if style == 'radial':
            system_prompt = """You are a mind map generation assistant. Analyze the provided content and create a RADIAL/DIVERGENT mind map in Mermaid syntax.
Focus on extracting key concepts and organizing them in a radial pattern around the main topic."""
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

        user_prompt = f"""Create a mind map in Mermaid syntax for: "{topic}"

Based on this content:
{file_content[:2000]}

Style: {'Radial/Divergent' if style == 'radial' else ('Top-Down' if style == 'TD' else 'Left-Right')} hierarchy
Depth: {depth_instruction}

Extract the main ideas and organize them {'in a radial pattern' if style == 'radial' else 'hierarchically'}. Output only valid Mermaid code."""

        try:
            response = self.client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                stream=False,
                temperature=0.7,
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
            # 发散型思维导图 - 使用 LR 并分散布局
            mermaid_code = f"""graph LR
    Center[{topic}]
    Center --> TR1[Concept 1]
    Center --> MR1[Concept 2]
    Center --> BR1[Concept 3]
    Center --> BL1[Concept 4]
    Center --> ML1[Concept 5]
    Center --> TL1[Concept 6]
    """
            if depth >= 2:
                mermaid_code += """    TR1 --> TR2[Detail 1.1]
    TR1 --> TR3[Detail 1.2]
    MR1 --> MR2[Detail 2.1]
    BR1 --> BR2[Detail 3.1]
    BR1 --> BR3[Detail 3.2]
    BL1 --> BL2[Detail 4.1]
    ML1 --> ML2[Detail 5.1]
    ML1 --> ML3[Detail 5.2]
    TL1 --> TL2[Detail 6.1]
    """
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

# 创建单例实例
ai_service = AIService()
