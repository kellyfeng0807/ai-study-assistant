# AI Study Assistant - NeurIPS 2025 Report

This directory contains the LaTeX source and compiled PDF of the project report in NeurIPS 2025 format.

## Files

- `main.tex` - Main LaTeX source file for the report
- `main_full.tex` - Full version with more detailed content (backup)
- `neurips_2025.sty` - NeurIPS 2025 LaTeX style file
- `main.pdf` - Compiled PDF (7 pages excluding references)

## Compiling the Report

### Prerequisites

Install LaTeX distribution (e.g., TeX Live):

```bash
# Ubuntu/Debian
sudo apt-get install texlive-latex-base texlive-latex-extra texlive-fonts-recommended texlive-fonts-extra

# macOS with Homebrew
brew install --cask mactex

# Windows
# Download and install MiKTeX or TeX Live from their official websites
```

### Compilation

```bash
cd report
pdflatex main.tex
pdflatex main.tex  # Run twice to resolve cross-references
```

The output will be `main.pdf`.

## Report Structure

The report follows NeurIPS 2025 format and includes all required sections:

1. **Abstract** - Overview of the AI Study Assistant system
2. **Introduction & Problem Definition** - Motivation and goals
3. **Related Work** - Literature review and context
4. **System Design** - Architecture, modules, and workflows
5. **Methods (AI Components)** - ASR, OCR, LLM, RAG integration details
6. **Implementation Details** - Database, API, frontend architecture
7. **Experiments & Case Studies** - Qualitative evaluation and performance
8. **Limitations & Future Work** - Current constraints and roadmap
9. **Conclusion** - Summary of contributions
10. **Broader Impacts and Ethics** - Privacy, equity, learning impact
11. **AI Tools Statement** - Transparency about AI usage in system and report
12. **Acknowledgments**
13. **References** - Bibliography

## Report Statistics

- **Page Count**: 7 pages (main content) + 1 page (references) = 8 pages total
- **Word Count**: ~3,500 words
- **Figures**: 1 (architecture diagram)
- **Tables**: 1 (performance measurements)
- **References**: 9 citations

## Compliance with Requirements

✓ ≤10 pages including figures and tables, excluding references  
✓ English language  
✓ NeurIPS template  
✓ All required sections included  
✓ AI tools usage statement included  

## Notes

- The report is based on the actual implementation in the repository
- All technical details, workflows, and case studies reflect the deployed system at https://ai-study-assistant-2ozw.onrender.com
- The LaTeX source includes inline comments for maintainability
- A full version (`main_full.tex`) with more detailed content is available for reference
