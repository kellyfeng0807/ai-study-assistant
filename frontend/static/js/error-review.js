// error-review.js

// 安全说明：
// - 题目/正确答案/分析：由 AI 或可信来源生成 → 可信任，不 escape，保留 LaTeX
// - 用户答案：来自用户输入 → 仅转义 HTML 标签，保留换行

let subject = "unknown"; // 全局默认值

// 优化的 MathJax 渲染：批量渲染和防抖
let renderQueue = [];
let renderTimeout = null;

function safeRenderMath(element) {
    if (!window.MathJax || !window.MathJax.typesetPromise) {
        console.warn('MathJax is not loaded. Skipping math rendering.');
        return;
    }

    // 添加到队列
    if (element && !renderQueue.includes(element)) {
        renderQueue.push(element);
    }

    // 防抖：100ms 后批量渲染
    clearTimeout(renderTimeout);
    renderTimeout = setTimeout(() => {
        if (renderQueue.length > 0) {
            const elements = [...renderQueue];
            renderQueue = [];
            
            MathJax.typesetPromise(elements).catch(err => {
                console.warn('MathJax rendering failed:', err);
            });
        }
    }, 100);
}

// 立即渲染（用于需要同步的场景）
function renderMathNow(elements) {
    if (!window.MathJax || !window.MathJax.typesetPromise) {
        return Promise.resolve();
    }
    
    const elementArray = Array.isArray(elements) ? elements : [elements];
    return MathJax.typesetPromise(elementArray).catch(err => {
        console.warn('MathJax rendering failed:', err);
    });
}

function cleanLatexForMathJax(text) {
    if (!text) return '';
    return text
        .replace(/\x0c/g, '')
        .replace(/\\x0crac/g, '\\frac')
        .replace(/\\x0c/g, '');
}

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const errorId = urlParams.get('id');
    console.log("errorId from URL:", errorId);

    const reviewCard = document.getElementById('reviewCard');
    if (!errorId) {
        if (reviewCard) reviewCard.innerHTML = '<p class="empty-state">Invalid review ID.</p>';
        return;
    }

    let card;
    
    // 从服务器获取数据
    try {
        const res = await fetch(window.getApiUrl(`/api/error/get?id=${encodeURIComponent(errorId)}`));
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }
        
        const data = await res.json();
        if (!data.success || !data.error) {
            throw new Error(data.error || 'Record not found');
        }
        
        card = data.error;
        subject = card.subject || "unknown";
        console.log("Loaded from database, subject:", subject);
        
    } catch (err) {
        console.error('Failed to fetch from database:', err);
        if (reviewCard) reviewCard.innerHTML = `<p class="empty-state">Error: ${err.message}</p>`;
        return;
    }

    if (!card) {
        if (reviewCard) reviewCard.innerHTML = '<p class="empty-state">Error record not found.</p>';
        return;
    }

    /* ---------------------- 渲染题目 ---------------------- */
    const questionEl = document.getElementById('questionContent');
    if (questionEl) {
        let htmlContent = cleanLatexForMathJax(card.question_text) || '<i>题目内容为空</i>';
        
        // 如果有裁切的图片，显示它们
        if (Array.isArray(card.images) && card.images.length > 0) {
            htmlContent += '<div class="question-images" style="margin-top: 12px; display: flex; flex-wrap: wrap; gap: 8px;">';
            card.images.forEach(imgPath => {
                htmlContent += `<img src="${imgPath}" alt="题目图片" style="max-width: 300px; max-height: 200px; border: 1px solid #ddd; border-radius: 4px;">`;
            });
            htmlContent += '</div>';
        }
        
        questionEl.innerHTML = htmlContent;
        safeRenderMath(questionEl);
    }

    /* ---------------------- 用户答案 ---------------------- */
    const userAnswerEl = document.getElementById('userAnswer');
    if (userAnswerEl) {
        const answerText = card.user_answer || '';
        userAnswerEl.innerHTML = answerText.replace(/\n/g, '<br>');
        safeRenderMath(userAnswerEl);
    }

    /* ---------------------- 正确答案 ---------------------- */
    const correctAnswerEl = document.getElementById('theAnswer');
    if (correctAnswerEl) {
        correctAnswerEl.innerHTML = cleanLatexForMathJax(card.correct_answer) || '<i>暂无</i>';
        safeRenderMath(correctAnswerEl);
    }

    /* ---------------------- 分析步骤 ---------------------- */
    const analysisEl = document.getElementById('analysisContent');
    if (analysisEl) {
        if (Array.isArray(card.analysis_steps) && card.analysis_steps.length > 0) {
            const html = '<ol>' +
                card.analysis_steps.map(step => `<li>${cleanLatexForMathJax(step)}</li>`).join('') +
                '</ol>';
            analysisEl.innerHTML = html;
            safeRenderMath(analysisEl);
        } else {
            analysisEl.innerHTML = '<i>No analysis available</i>';
        }
    }

    /* ---------------------- 上次重做信息（redo_answer + redo_time） ---------------------- */
    function updateRedoSection(cardData) {
        const redoSection = document.getElementById('lastRedoSection');
        const redoTimeDisplay = document.getElementById('redoTimeDisplay');
        const lastRedoAnswerEl = document.getElementById('lastRedoAnswer');

        if (redoSection && redoTimeDisplay && lastRedoAnswerEl) {
            if (cardData.redo_answer != null && cardData.redo_answer.trim() !== '' && cardData.redo_time) {
                // 显示重做板块
                redoSection.style.display = 'block';

                // 格式化时间
                const redoDate = new Date(cardData.redo_time);
                redoTimeDisplay.textContent = redoDate.toLocaleString('zh-CN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                });

                // 渲染答案（支持 LaTeX）
                const cleaned = cleanLatexForMathJax(cardData.redo_answer.trim());
                lastRedoAnswerEl.innerHTML = cleaned;
                safeRenderMath(lastRedoAnswerEl);
            } else {
                // 隐藏板块
                redoSection.style.display = 'none';
            }
        }
    }

    // 初始加载
    updateRedoSection(card);
    /* ---------------------- 元信息 ---------------------- */
    const metaEl = document.getElementById('metaInfo');
    if (metaEl) {
        const tags = Array.isArray(card.tags) ? card.tags.join(', ') : '';
        metaEl.textContent = `Subject: ${card.subject || 'unknown'} • Type: ${card.type || 'unknown'} • Tags: ${tags || 'none'}`;
    }

    /* ---------------------- 标题 ---------------------- */
    const titleEl = document.getElementById('qTitle');
    if (titleEl) titleEl.textContent = card.title || 'Question';

    /* ---------------------- 返回按钮 ---------------------- */
    const backBtn = document.getElementById('backBtn');
    if (backBtn) backBtn.addEventListener('click', () => window.history.back());

    /* ---------------------- 刷新按钮 ---------------------- */
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            refreshBtn.disabled = true;
            refreshBtn.querySelector('i').classList.add('fa-spin');
            
            try {
                const refreshRes = await fetch(window.getApiUrl(`/api/error/get?id=${encodeURIComponent(errorId)}`));
                const refreshData = await refreshRes.json();
                if (refreshData.success && refreshData.error) {
                    updateRedoSection(refreshData.error);
                    // 可选：显示成功提示
                    console.log('Redo section refreshed successfully');
                }
            } catch (refreshErr) {
                console.error('Failed to refresh:', refreshErr);
                alert('Failed to refresh. Please try again.');
            } finally {
                refreshBtn.disabled = false;
                refreshBtn.querySelector('i').classList.remove('fa-spin');
            }
        });
    }

    /* ============================================
     *        Dropzone 拖拽上传
     * ============================================ */
    const dropzone = document.getElementById("redoDropzone");
    const fileInput = document.getElementById("redoFile");
    const previewDiv = document.getElementById("redoPreview");
    const previewImg = document.getElementById("redoPreviewImg");

    if (dropzone && fileInput) {
        // 点击打开文件选择
        dropzone.addEventListener("click", () => fileInput.click());

        // 拖进来改变样式
        dropzone.addEventListener("dragover", (e) => {
            e.preventDefault();
            dropzone.classList.add("dragover");
        });

        dropzone.addEventListener("dragleave", () => {
            dropzone.classList.remove("dragover");
        });

        // 放下文件
        dropzone.addEventListener("drop", (e) => {
            e.preventDefault();
            dropzone.classList.remove("dragover");
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                fileInput.files = e.dataTransfer.files;
                updatePreview(file);
            }
        });

        // 选择文件后更新预览
        fileInput.addEventListener("change", () => {
            const file = fileInput.files[0];
            if (file) {
                updatePreview(file);
            }
        });

        function updatePreview(file) {
            const dzText = dropzone.querySelector(".dz-text");
            if (dzText) dzText.textContent = `已选择：${file.name}`;
            
            // 显示预览图
            if (previewDiv && previewImg) {
                // 清除之前的预览图（释放内存）
                if (previewImg.src && previewImg.src.startsWith('blob:')) {
                    URL.revokeObjectURL(previewImg.src);
                }
                
                const reader = new FileReader();
                reader.onload = (e) => {
                    previewImg.src = e.target.result;
                    previewDiv.style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        }
    }


    /* =====================================================
     *                重做（redo）功能
     * ===================================================== */
    const redoBtn = document.getElementById('redoBtn');
    const redoResultEl = document.getElementById('redoResult');

    if (redoBtn && fileInput && redoResultEl) {
        redoBtn.addEventListener('click', async () => {
            const file = fileInput.files[0];
            if (!file) {
                redoResultEl.textContent = 'Please select an image first.';
                redoResultEl.className = 'redo-result err';
                return;
            }

            // 读取文件为 base64
            const reader = new FileReader();
            reader.onload = async (e) => {
                const base64Data = e.target.result;
                
                redoResultEl.textContent = 'Submitting...';
                redoResultEl.className = 'redo-result';

                try {
                    const res = await fetch(window.getApiUrl('/api/error/redo'), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            id: errorId,
                            redo_answer: base64Data
                        })
                    });
                    const data = await res.json();
                    console.log("Redo response:", data);

                    if (!data.success) {
                        redoResultEl.textContent = `failed: ${data.error || '未知错误'}`;
                        redoResultEl.className = 'redo-result err';
                        return;
                    }

                    if (data.is_correct === true) {
                        redoResultEl.textContent = 'Correct ';
                        redoResultEl.className = 'redo-result ok';
                    } else {
                        redoResultEl.textContent = 'Incorrect ';
                        redoResultEl.className = 'redo-result err';
                    }

                    // 自动刷新 redo 区域
                    try {
                        const refreshRes = await fetch(window.getApiUrl(`/api/error/get?id=${encodeURIComponent(errorId)}`));
                        const refreshData = await refreshRes.json();
                        if (refreshData.success && refreshData.error) {
                            updateRedoSection(refreshData.error);
                        }
                    } catch (refreshErr) {
                        console.error('Failed to refresh redo section:', refreshErr);
                    }

                } catch (err) {
                    console.error('Redo error:', err);
                    redoResultEl.textContent = `failed: ${err.message}`;
                    redoResultEl.className = 'redo-result err';
                }
            };
            reader.readAsDataURL(file);
        });
    }

    /* ============================================
     *        文本重做（手动输入答案）
     * ============================================ */
    const redoTextBtn = document.getElementById('textRedoBtn');      // 匹配 HTML
    const redoTextResultEl = document.getElementById('textRedoResult'); // 
    const redoTextInput = document.getElementById('textAnswer');       // 

    if (redoTextBtn && redoTextResultEl && redoTextInput && errorId) {
        redoTextBtn.addEventListener('click', async () => {
            const userAnswer = redoTextInput.value.trim();
            if (!userAnswer) {
                redoTextResultEl.textContent = 'Please enter your answer first.';
                redoTextResultEl.className = 'redo-result err';
                return;
            }

            redoTextResultEl.textContent = 'Submitting...';
            redoTextResultEl.className = 'redo-result';

            try {
                const res = await fetch(window.getApiUrl('/api/error/redo_text'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: errorId,
                        user_answer: userAnswer
                    })
                });

                const data = await res.json();
                console.log("Text redo response:", data);

                if (!data.success) {
                    redoTextResultEl.textContent = `fail to summit: ${data.error || 'unknown error'}`;
                    redoTextResultEl.className = 'redo-result err';
                    return;
                }

                if (data.correct) {
                    redoTextResultEl.textContent = 'Correct';
                    redoTextResultEl.className = 'redo-result ok';
                } else {
                    redoTextResultEl.textContent = `Incorrect  ${data.ai_reason || ''}`;
                    redoTextResultEl.className = 'redo-result err';
                }

                // 自动刷新 redo 区域
                try {
                    const refreshRes = await fetch(window.getApiUrl(`/api/error/get?id=${encodeURIComponent(errorId)}`));
                    const refreshData = await refreshRes.json();
                    if (refreshData.success && refreshData.error) {
                        updateRedoSection(refreshData.error);
                    }
                } catch (refreshErr) {
                    console.error('Failed to refresh redo section:', refreshErr);
                }

            } catch (err) {
                console.error('Text redo error:', err);
                redoTextResultEl.textContent = `summition error: ${err.message}`;
                redoTextResultEl.className = 'redo-result err';
            }
        });

        // 可选：实现 Clear 按钮
        const clearBtn = document.getElementById('textRedoClearBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                redoTextInput.value = '';
                redoTextResultEl.textContent = '';
                redoTextResultEl.className = 'redo-result';
            });
        }
    }



    /* ============================================
     *        折叠/展开正确答案和分析
     * ============================================ */
    document.querySelectorAll('.toggle-details').forEach(btn => {
        btn.addEventListener('click', () => {
            const details = btn.nextElementSibling;
            if (!details) return;

            const isVisible = details.style.display === 'block';
            details.style.display = isVisible ? 'none' : 'block';

            btn.innerHTML = isVisible
                ? '<i class="fas fa-chevron-down"></i> Show Details'
                : '<i class="fas fa-chevron-up"></i> Hide Details';

            // 展开时渲染 MathJax
            if (!isVisible && window.MathJax) {
                MathJax.typesetPromise([details]).catch(console.warn);
            }
        });
    });
});
