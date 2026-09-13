const { useState, useEffect, useRef } = React;

const CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
const API_KEY = 'YOUR_GOOGLE_API_KEY';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

function App() {
    const [activeTab, setActiveTab] = useState('editor');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    
    const [isGoogleLoggedIn, setIsGoogleLoggedIn] = useState(false);
    const [driveFiles, setDriveFiles] = useState([]);
    const [driveModalOpen, setDriveModalOpen] = useState(false);
    const [gapiLoaded, setGapiLoaded] = useState(false);
    const [tokenClient, setTokenClient] = useState(null);
    const [accessToken, setAccessToken] = useState(null);
    
    const [volumes, setVolumes] = useState(() => {
        const saved = localStorage.getItem('storyseed_volumes_v17');
        return saved ? JSON.parse(saved) : [
            {
                id: 1,
                title: '제 1권. 각성의 서막',
                episodes: [
                    { id: 101, title: '1화. 각성의 서막', content: '여기는 1화 본문 내용입니다.' },
                    { id: 102, title: '2화. 그림자의 습격', content: '여기는 2화 본문입니다.' }
                ]
            }
        ];
    });

    const [currentEpisodeId, setCurrentEpisodeId] = useState(() => {
        const saved = localStorage.getItem('storyseed_current_ep_id_v17');
        return saved ? Number(saved) : 101;
    });

    const [history, setHistory] = useState(['']);
    const [historyIndex, setHistoryIndex] = useState(0);

    const [saveStatus, setSaveStatus] = useState('안전 동기화됨');
    const [newVolumeTitleInput, setNewVolumeTitleInput] = useState('');
    const [newEpModalOpen, setNewEpModalOpen] = useState(false);
    const [targetVolumeId, setTargetVolumeId] = useState(null);
    const [newEpTitleInput, setNewEpTitleInput] = useState('');

    const [resetModalOpen, setResetModalOpen] = useState(false);
    const [lineSpacingModal, setLineSpacingModal] = useState(false);
    const [spacingConfig, setSpacingConfig] = useState({ jiwun: 1, dialogue: 0 });

    const [timelines, setTimelines] = useState(() => {
        const saved = localStorage.getItem('storyseed_timelines_v17');
        return saved ? JSON.parse(saved) : [
            { id: 1, badge: '프롤로그', title: '12년 전 계양의 날', desc: '구조탑의 붕괴와 주인공 어머니의 희생 암시.' }
        ];
    });
    const [newTimeline, setNewTimeline] = useState({ badge: '', title: '', desc: '' });
    const [timelineSort, setTimelineSort] = useState('latest');

    const [foreshadows, setForeshadows] = useState(() => {
        const saved = localStorage.getItem('storyseed_foreshadows_v17');
        return saved ? JSON.parse(saved) : [
            { id: 1, badge: '3화 던짐', status: '미회수', title: '12년 전 부모님의 유품 속 문양', desc: '회수 목표: 20화' }
        ];
    });
    const [newForeshadow, setNewForeshadow] = useState({ badge: '', title: '', desc: '' });
    const [foreshadowSort, setForeshadowSort] = useState('latest');

    const [memos, setMemos] = useState(() => {
        const saved = localStorage.getItem('storyseed_memos_v17');
        return saved ? JSON.parse(saved) : [
            { id: 1, x: 50, y: 100, w: 220, h: 160, color: 'bg-amber-100 text-slate-900 border border-amber-300', title: '구조 위치 서명', content: '청안옥, 16화 해설 벤트에서 스치듯 언급만' }
        ];
    });
    const [toolbarPos, setToolbarPos] = useState({ x: 20, y: 80 });
    const [canvasSize, setCanvasSize] = useState({ width: 3000, height: 3000 });

    const [isDrawingMode, setIsDrawingMode] = useState(false);
    const [isPanMode, setIsPanMode] = useState(false); 
    const canvasRef = useRef(null);
    const memoContainerRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [brushColor, setBrushColor] = useState('#ec4899');
    const [brushWidth, setBrushWidth] = useState(4);

    const [backupModalOpen, setBackupModalOpen] = useState(false);
    const [backupJsonText, setBackupJsonText] = useState('');

    useEffect(() => {
        const scriptGapi = document.createElement('script');
        scriptGapi.src = 'https://apis.google.com/js/api.js';
        scriptGapi.onload = () => {
            window.gapi.load('client', initializeGapiClient);
        };
        document.body.appendChild(scriptGapi);

        const scriptGsi = document.createElement('script');
        scriptGsi.src = 'https://accounts.google.com/gsi/client';
        scriptGsi.onload = () => {
            initializeGsiClient();
        };
        document.body.appendChild(scriptGsi);
    }, []);

    const initializeGapiClient = async () => {
        await window.gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        });
        setGapiLoaded(true);
    };

    const initializeGsiClient = () => {
        const client = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: (response) => {
                if (response.access_token) {
                    setAccessToken(response.access_token);
                    setIsGoogleLoggedIn(true);
                    alert("구글 드라이브 연동 성공!");
                }
            },
        });
        setTokenClient(client);
    };

    const handleGoogleLogin = () => {
        if (tokenClient) {
            tokenClient.requestAccessToken({ prompt: 'consent' });
        } else {
            alert("구글 API가 아직 로드되지 않았습니다. 잠시 후 다시 시도해주세요.");
        }
    };

    const saveToGoogleDrive = async () => {
        if (!accessToken) {
            alert("먼저 구글 로그인을 진행해주세요!");
            handleGoogleLogin();
            return;
        }

        setSaveStatus('드라이브 백업 중...');
        const backupData = { volumes, currentEpisodeId, timelines, foreshadows, memos, toolbarPos };
        const fileContent = JSON.stringify(backupData, null, 2);
        const file = new Blob([fileContent], { type: 'application/json' });
        const metadata = {
            name: `StorySeed_Backup_${Date.now()}.json`,
            mimeType: 'application/json',
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);

        try {
            const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
                body: form,
            });
            if (res.ok) {
                setSaveStatus('안전 동기화됨');
                alert("구글 드라이브에 성공적으로 백업되었습니다.");
            } else {
                setSaveStatus('저장 실패');
                alert("드라이브 저장 중 오류가 발생했습니다.");
            }
        } catch (err) {
            setSaveStatus('저장 실패');
            console.error(err);
        }
    };

    const fetchDriveFiles = async () => {
        if (!accessToken) {
            alert("먼저 구글 로그인을 진행해주세요!");
            handleGoogleLogin();
            return;
        }

        try {
            const res = await fetch("https://www.googleapis.com/drive/v3/files?q=name contains 'StorySeed_Backup' and trashed=false", {
                method: 'GET',
                headers: new Headers({ 'Authorization': 'Bearer ' + accessToken })
            });
            const data = await res.json();
            if (data.files) {
                setDriveFiles(data.files);
                setDriveModalOpen(true);
            }
        } catch (err) {
            alert("파일 목록을 불러오지 못했습니다.");
        }
    };

    const loadFromDriveFile = async (fileId) => {
        try {
            const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
                method: 'GET',
                headers: new Headers({ 'Authorization': 'Bearer ' + accessToken })
            });
            const parsed = await res.json();
            if (parsed.volumes) {
                setVolumes(parsed.volumes);
                if (parsed.currentEpisodeId) setCurrentEpisodeId(parsed.currentEpisodeId);
                if (parsed.timelines) setTimelines(parsed.timelines);
                if (parsed.foreshadows) setForeshadows(parsed.foreshadows);
                if (parsed.memos) setMemos(parsed.memos);
                if (parsed.toolbarPos) setToolbarPos(parsed.toolbarPos);
                alert("구글 드라이브에서 프로젝트를 성공적으로 불러왔습니다!");
                setDriveModalOpen(false);
            }
        } catch (err) {
            alert("파일 내용을 읽어오는 데 실패했습니다.");
        }
    };

    let currentEp = null;
    for (const vol of volumes) {
        const found = vol.episodes.find(ep => ep.id === currentEpisodeId);
        if (found) {
            currentEp = found;
            break;
        }
    }
    if (!currentEp && volumes.length > 0 && volumes[0].episodes.length > 0) {
        currentEp = volumes[0].episodes[0];
    }

    useEffect(() => {
        if (currentEp) {
            setHistory([currentEp.content || '']);
            setHistoryIndex(0);
        }
    }, [currentEpisodeId]);

    useEffect(() => {
        setSaveStatus('저장 중...');
        const timer = setTimeout(() => {
            localStorage.setItem('storyseed_volumes_v17', JSON.stringify(volumes));
            localStorage.setItem('storyseed_current_ep_id_v17', currentEpisodeId);
            localStorage.setItem('storyseed_timelines_v17', JSON.stringify(timelines));
            localStorage.setItem('storyseed_foreshadows_v17', JSON.stringify(foreshadows));
            localStorage.setItem('storyseed_memos_v17', JSON.stringify(memos));
            setSaveStatus('안전 동기화됨');
        }, 400);
        return () => clearTimeout(timer);
    }, [volumes, currentEpisodeId, timelines, foreshadows, memos]);

    const handleContentChange = (newText, isUndoRedo = false) => {
        setVolumes(volumes.map(vol => ({
            ...vol,
            episodes: vol.episodes.map(ep => ep.id === currentEpisodeId ? { ...ep, content: newText } : ep)
        })));

        if (!isUndoRedo) {
            const newHistory = history.slice(0, historyIndex + 1);
            newHistory.push(newText);
            setHistory(newHistory);
            setHistoryIndex(newHistory.length - 1);
        }
    };

    const undo = () => {
        if (historyIndex > 0) {
            const nextIndex = historyIndex - 1;
            setHistoryIndex(nextIndex);
            handleContentChange(history[nextIndex], true);
        }
    };

    const redo = () => {
        if (historyIndex < history.length - 1) {
            const nextIndex = historyIndex + 1;
            setHistoryIndex(nextIndex);
            handleContentChange(history[nextIndex], true);
        }
    };

    const addVolume = () => {
        if (!newVolumeTitleInput.trim()) return;
        const newVol = {
            id: Date.now(),
            title: newVolumeTitleInput.trim(),
            episodes: []
        };
        setVolumes([...volumes, newVol]);
        setNewVolumeTitleInput('');
    };

    const openAddEpisodeModal = (volId) => {
        setTargetVolumeId(volId);
        setNewEpTitleInput('');
        setNewEpModalOpen(true);
    };

    const confirmAddEpisode = () => {
        if (!newEpTitleInput.trim()) return;
        const newEpId = Date.now();
        const newEpisode = {
            id: newEpId,
            title: newEpTitleInput.trim(),
            content: '새로운 회차의 본문을 작성하세요.'
        };

        setVolumes(volumes.map(vol => {
            if (vol.id === targetVolumeId) {
                return { ...vol, episodes: [...vol.episodes, newEpisode] };
            }
            return vol;
        }));

        setCurrentEpisodeId(newEpId);
        setNewEpModalOpen(false);
        setSidebarOpen(false);
    };

    const deleteEpisode = (e, volId, epId) => {
        e.stopPropagation();
        if (confirm("정말 이 화를 삭제하시겠습니까?")) {
            const updatedVolumes = volumes.map(vol => {
                if (vol.id === volId) {
                    return { ...vol, episodes: vol.episodes.filter(ep => ep.id !== epId) };
                }
                return vol;
            });
            setVolumes(updatedVolumes);
            
            if (currentEpisodeId === epId) {
                let nextEpId = null;
                for (const vol of updatedVolumes) {
                    if (vol.episodes.length > 0) {
                        nextEpId = vol.episodes[0].id;
                        break;
                    }
                }
                if (nextEpId) setCurrentEpisodeId(nextEpId);
            }
        }
    };

    const executeReset = () => {
        handleContentChange('');
        setResetModalOpen(false);
    };

    const applyLineSpacing = () => {
        try {
            let text = currentEp ? currentEp.content || '' : '';
            let rawLines = text.split('\n');
            let cleanedLines = [];

            for (let i = 0; i < rawLines.length; i++) {
                let line = rawLines[i].trim();
                if (line !== '') cleanedLines.push(line);
            }

            if (cleanedLines.length === 0) {
                setLineSpacingModal(false);
                return;
            }

            let processedBlocks = [];
            for (let i = 0; i < cleanedLines.length; i++) {
                let currentLine = cleanedLines[i];
                processedBlocks.push(currentLine);

                if (i < cleanedLines.length - 1) {
                    let isCurrentDialogue = currentLine.startsWith('"') || currentLine.startsWith('“') || currentLine.startsWith("'") || currentLine.startsWith('‘');
                    let nextLine = cleanedLines[i + 1];
                    let isNextDialogue = nextLine.startsWith('"') || nextLine.startsWith('“') || nextLine.startsWith("'") || nextLine.startsWith('‘');

                    if (!isCurrentDialogue && !isNextDialogue) {
                        processedBlocks.push('\n'.repeat(spacingConfig.jiwun + 1));
                    } else if (isCurrentDialogue && isNextDialogue) {
                        processedBlocks.push('\n'.repeat(spacingConfig.dialogue + 1));
                    } else {
                        processedBlocks.push('\n\n');
                    }
                }
            }

            handleContentChange(processedBlocks.join(''));
            setLineSpacingModal(false);
        } catch (error) {
            setLineSpacingModal(false);
        }
    };

    const openBackupModal = () => {
        const backupData = { volumes, currentEpisodeId, timelines, foreshadows, memos, toolbarPos };
        setBackupJsonText(JSON.stringify(backupData, null, 2));
        setBackupModalOpen(true);
    };

    const importData = (e) => {
        const fileReader = new FileReader();
        if (e.target.files[0]) {
            fileReader.readAsText(e.target.files[0], "UTF-8");
            fileReader.onload = (event) => {
                try {
                    const parsed = JSON.parse(event.target.result);
                    if (parsed.volumes) {
                        setVolumes(parsed.volumes);
                        if (parsed.currentEpisodeId) setCurrentEpisodeId(parsed.currentEpisodeId);
                        if (parsed.timelines) setTimelines(parsed.timelines);
                        if (parsed.foreshadows) setForeshadows(parsed.foreshadows);
                        if (parsed.memos) setMemos(parsed.memos);
                        if (parsed.toolbarPos) setToolbarPos(parsed.toolbarPos);
                        alert("백업 데이터가 성공적으로 복원되었습니다!");
                    }
                } catch (err) {
                    alert("올바른 백업 파일 형식이 아닙니다.");
                }
            };
        }
    };

    const sortedTimelines = [...timelines].sort((a, b) => {
        if (timelineSort === 'latest') return b.id - a.id;
        if (timelineSort === 'oldest') return a.id - b.id;
        if (timelineSort === 'alphabet') return a.title.localeCompare(b.title, 'ko');
        return 0;
    });

    const sortedForeshadows = [...foreshadows].sort((a, b) => {
        if (foreshadowSort === 'latest') return b.id - a.id;
        if (foreshadowSort === 'oldest') return a.id - b.id;
        if (foreshadowSort === 'alphabet') return a.title.localeCompare(b.title, 'ko');
        return 0;
    });

    const memoThemes = [
        { name: '노란색', class: 'bg-amber-100 text-slate-900 border border-amber-300' },
        { name: '핑크색', class: 'bg-pink-100 text-slate-900 border border-pink-300' },
        { name: '초록색', class: 'bg-emerald-100 text-slate-900 border border-emerald-300' },
        { name: '보라색', class: 'bg-purple-100 text-slate-900 border border-purple-300' },
        { name: '어두운색', class: 'bg-slate-800 text-slate-100 border border-slate-700' }
    ];

    const addMemo = (colorClass = 'bg-amber-100 text-slate-900 border border-amber-300') => {
        const newMemoItem = {
            id: Date.now(),
            x: 100 + (memos.length * 20) % 300,
            y: 150 + (memos.length * 20) % 300,
            w: 220,
            h: 160,
            color: colorClass,
            title: '새 메모',
            content: '내용을 입력하세요.'
        };
        setMemos([...memos, newMemoItem]);
    };

    const updateMemoContent = (id, field, value) => {
        setMemos(memos.map(m => m.id === id ? { ...m, [field]: value } : m));
    };

    const deleteMemo = (id) => {
        setMemos(memos.filter(m => m.id !== id));
    };

    const [draggingMemoId, setDraggingMemoId] = useState(null);
    const [isDraggingToolbar, setIsDraggingToolbar] = useState(false);
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    const handleMemoHeaderMouseDown = (e, memo) => {
        if (isPanMode) return;
        e.stopPropagation();
        setDraggingMemoId(memo.id);
        setDragOffset({ x: e.clientX - memo.x, y: e.clientY - memo.y });
    };

    const handleMemoHeaderTouchStart = (e, memo) => {
        if (isPanMode) return;
        e.stopPropagation();
        const touch = e.touches[0];
        setDraggingMemoId(memo.id);
        setDragOffset({ x: touch.clientX - memo.x, y: touch.clientY - memo.y });
    };

    const handleToolbarMouseDown = (e) => {
        e.stopPropagation();
        setIsDraggingToolbar(true);
        setDragOffset({ x: e.clientX - toolbarPos.x, y: e.clientY - toolbarPos.y });
    };

    const handleToolbarTouchStart = (e) => {
        e.stopPropagation();
        const touch = e.touches[0];
        setIsDraggingToolbar(true);
        setDragOffset({ x: touch.clientX - toolbarPos.x, y: touch.clientY - toolbarPos.y });
    };

    const handleContainerMouseDown = (e) => {
        if (isPanMode) {
            setIsPanning(true);
            setPanStart({
                x: e.clientX,
                y: e.clientY,
                scrollLeft: memoContainerRef.current ? memoContainerRef.current.scrollLeft : 0,
                scrollTop: memoContainerRef.current ? memoContainerRef.current.scrollTop : 0
            });
        }
    };

    const handleContainerTouchStart = (e) => {
        if (isPanMode && e.touches.length === 1) {
            setIsPanning(true);
            const touch = e.touches[0];
            setPanStart({
                x: touch.clientX,
                y: touch.clientY,
                scrollLeft: memoContainerRef.current ? memoContainerRef.current.scrollLeft : 0,
                scrollTop: memoContainerRef.current ? memoContainerRef.current.scrollTop : 0
            });
        }
    };

    useEffect(() => {
        const handleGlobalMouseMove = (e) => {
            if (isPanning && memoContainerRef.current) {
                const dx = e.clientX - panStart.x;
                const dy = e.clientY - panStart.y;
                memoContainerRef.current.scrollLeft = panStart.scrollLeft - dx;
                memoContainerRef.current.scrollTop = panStart.scrollTop - dy;
            } else if (draggingMemoId !== null) {
                e.preventDefault();
                const x = Math.max(0, e.clientX - dragOffset.x);
                const y = Math.max(0, e.clientY - dragOffset.y);
                setMemos(memos => memos.map(m => m.id === draggingMemoId ? { ...m, x, y } : m));
            } else if (isDraggingToolbar) {
                e.preventDefault();
                const x = Math.max(0, e.clientX - dragOffset.x);
                const y = Math.max(0, e.clientY - dragOffset.y);
                setToolbarPos({ x, y });
            }
        };

        const handleGlobalTouchMove = (e) => {
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                if (isPanning && memoContainerRef.current) {
                    const dx = touch.clientX - panStart.x;
                    const dy = touch.clientY - panStart.y;
                    memoContainerRef.current.scrollLeft = panStart.scrollLeft - dx;
                    memoContainerRef.current.scrollTop = panStart.scrollTop - dy;
                } else if (draggingMemoId !== null) {
                    const x = Math.max(0, touch.clientX - dragOffset.x);
                    const y = Math.max(0, touch.clientY - dragOffset.y);
                    setMemos(memos => memos.map(m => m.id === draggingMemoId ? { ...m, x, y } : m));
                } else if (isDraggingToolbar) {
                    const x = Math.max(0, touch.clientX - dragOffset.x);
                    const y = Math.max(0, touch.clientY - dragOffset.y);
                    setToolbarPos({ x, y });
                }
            }
        };

        const handleGlobalMouseUp = () => {
            setDraggingMemoId(null);
            setIsDraggingToolbar(false);
            setIsPanning(false);
        };

        if (isPanning || draggingMemoId !== null || isDraggingToolbar) {
            window.addEventListener('mousemove', handleGlobalMouseMove);
            window.addEventListener('mouseup', handleGlobalMouseUp);
            window.addEventListener('touchmove', handleGlobalTouchMove);
            window.addEventListener('touchend', handleGlobalMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
            window.removeEventListener('touchmove', handleGlobalTouchMove);
            window.removeEventListener('touchend', handleGlobalMouseUp);
        };
    }, [isPanning, draggingMemoId, isDraggingToolbar, panStart, dragOffset]);

    const startDrawing = (e) => {
        if (!isDrawingMode || isPanMode) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
    };

    const draw = (e) => {
        if (!isDrawingMode || !isDrawing || isPanMode) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        ctx.strokeStyle = brushColor;
        ctx.lineWidth = brushWidth;
        ctx.lineCap = 'round';
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-[#0b0f19]">
            <div className="flex-1 overflow-y-auto flex flex-col">
                <header className="bg-[#111827] border-b border-slate-800/85 px-3 py-2 flex flex-col gap-2 shadow-md shrink-0">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
                            <h1 className="font-bold text-slate-100 text-xs sm:text-sm">StorySeed</h1>
                        </div>
                        <div className="flex bg-[#0f172a] rounded-lg p-0.5 border border-slate-800 overflow-x-auto max-w-[65vw]">
                            <button onClick={() => setActiveTab('editor')} className={`px-2.5 py-1 rounded-md text-xs font-semibold shrink-0 ${activeTab === 'editor' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>에디터</button>
                            <button onClick={() => setActiveTab('timeline')} className={`px-2.5 py-1 rounded-md text-xs font-semibold shrink-0 ${activeTab === 'timeline' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>타임라인</button>
                            <button onClick={() => setActiveTab('foreshadow')} className={`px-2.5 py-1 rounded-md text-xs font-semibold shrink-0 ${activeTab === 'foreshadow' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>복선</button>
                            <button onClick={() => setActiveTab('memo')} className={`px-2.5 py-1 rounded-md text-xs font-semibold shrink-0 ${activeTab === 'memo' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>메모보드</button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-800/60">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">{saveStatus}</span>
                            <div className="flex items-center space-x-1.5 flex-wrap justify-end">
                                {!isGoogleLoggedIn ? (
                                    <button onClick={handleGoogleLogin} className="bg-blue-600 hover:bg-blue-500 text-white text-[11px] px-2.5 py-1 rounded font-semibold shadow">구글 로그인</button>
                                ) : (
                                    <>
                                        <button onClick={saveToGoogleDrive} className="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] px-2.5 py-1 rounded font-semibold shadow">드라이브 저장</button>
                                        <button onClick={fetchDriveFiles} className="bg-slate-700 hover:bg-slate-600 text-white text-[11px] px-2.5 py-1 rounded font-semibold shadow">드라이브 목록</button>
                                    </>
                                )}
                                <button onClick={openBackupModal} className="bg-slate-800 text-slate-300 text-[11px] px-2.5 py-1 rounded border border-slate-700">백업</button>
                                <label className="bg-slate-800 text-slate-300 text-[11px] px-2.5 py-1 rounded border border-slate-700 cursor-pointer">
                                    불러오기
                                    <input type="file" accept=".json" onChange={importData} className="hidden" />
                                </label>
                            </div>
                        </div>

                        {activeTab === 'editor' && (
                            <div className="flex justify-end items-center space-x-1.5">
                                <button onClick={() => setResetModalOpen(true)} className="bg-rose-950/60 text-rose-300 hover:bg-rose-900 px-2.5 py-1 rounded text-[11px] font-semibold border border-rose-800/50">초기화</button>
                                <button onClick={() => setLineSpacingModal(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1 rounded text-[11px] font-semibold">포맷터</button>
                            </div>
                        )}
                    </div>
                </header>

                <main className="flex-1 relative flex flex-col min-h-[calc(100vh-65px)]">
                    {activeTab === 'editor' && (
                        <div className="flex h-full relative flex-1">
                            {sidebarOpen && (
                                <div onClick={() => setSidebarOpen(false)} className="absolute inset-0 bg-black/60 z-20 md:hidden"></div>
                            )}

                            <div className={`absolute md:relative z-30 inset-y-0 left-0 w-80 max-w-[85vw] bg-[#0e131f] border-r border-slate-800 p-4 flex flex-col justify-between transition-transform duration-300 box-border ${sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}`}>
                                <div className="overflow-y-auto pr-1 flex-1 space-y-4">
                                    <div className="flex justify-between items-center md:hidden pb-2 border-b border-slate-800">
                                        <span className="text-xs font-bold text-slate-300">📚 목차 바인더</span>
                                        <button onClick={() => setSidebarOpen(false)} className="text-slate-400 text-xs px-2 py-1 bg-slate-800 rounded">✕ 닫기</button>
                                    </div>
                                    
                                    <div className="bg-[#131c2e]/60 p-3 rounded-xl border border-slate-800 box-border">
                                        <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">📁 새 장/부 추가</h2>
                                        <div className="flex items-center space-x-2 w-full">
                                            <input 
                                                type="text" 
                                                placeholder="예: 제 2권" 
                                                value={newVolumeTitleInput}
                                                onChange={(e) => setNewVolumeTitleInput(e.target.value)}
                                                className="bg-[#0b0f19] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 min-w-0 flex-1 focus:outline-none"
                                            />
                                            <button onClick={addVolume} className="bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-lg font-semibold shrink-0">추가</button>
                                        </div>
                                    </div>

                                    <div>
                                        <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">📚 작품 목차</h2>
                                        <div className="space-y-3">
                                            {volumes.map((vol) => (
                                                <div key={vol.id} className="bg-[#131c2e]/40 p-2.5 rounded-xl border border-slate-800 box-border">
                                                    <div className="flex justify-between items-center mb-2 gap-2">
                                                        <span className="text-xs font-bold text-indigo-300 truncate min-w-0 flex-1">📂 {vol.title}</span>
                                                        <button onClick={() => openAddEpisodeModal(vol.id)} className="bg-indigo-600 text-white text-[10px] px-2 py-1 rounded font-semibold shrink-0">+ 새 화차</button>
                                                    </div>
                                                    <div className="space-y-1 pl-2 border-l border-indigo-500/20">
                                                        {vol.episodes.map((ep) => (
                                                            <div 
                                                                key={ep.id} 
                                                                onClick={() => { setCurrentEpisodeId(ep.id); setSidebarOpen(false); }} 
                                                                className={`p-2 rounded-lg cursor-pointer text-xs transition flex justify-between items-center ${currentEpisodeId === ep.id ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/40 font-semibold' : 'text-slate-400 hover:bg-slate-900'}`}
                                                            >
                                                                <span className="truncate pr-2">📄 {ep.title}</span>
                                                                <button 
                                                                    onClick={(e) => deleteEpisode(e, vol.id, ep.id)} 
                                                                    className="text-slate-500 hover:text-rose-400 px-1 text-[11px]" 
                                                                    title="화 삭제"
                                                                >
                                                                    🗑️
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 bg-[#0b0f19] flex flex-col h-full min-w-0">
                                <div className="bg-[#111827]/60 px-3 py-2 border-b border-slate-800 flex justify-between items-center text-xs text-slate-400">
                                    <div className="flex items-center space-x-2 min-w-0">
                                        <button onClick={() => setSidebarOpen(true)} className="md:hidden bg-indigo-600 text-white px-2 py-1 rounded text-xs font-semibold shrink-0">📁 목차</button>
                                        <span className="truncate text-[11px] sm:text-xs">집필 중: <strong className="text-indigo-300">{currentEp ? currentEp.title : ''}</strong></span>
                                    </div>
                                    <div className="flex bg-[#0b0f19] border border-slate-700 rounded-lg overflow-hidden shrink-0">
                                        <button onClick={undo} disabled={historyIndex === 0} className={`px-2.5 py-1 text-xs ${historyIndex === 0 ? 'text-slate-600 cursor-not-allowed' : 'text-slate-200 hover:bg-slate-800'}`} title="실행 취소">↩️</button>
                                        <button onClick={redo} disabled={historyIndex === history.length - 1} className={`px-2.5 py-1 text-xs border-l border-slate-700 ${historyIndex === history.length - 1 ? 'text-slate-600 cursor-not-allowed' : 'text-slate-200 hover:bg-slate-800'}`} title="다시 실행">🔁</button>
                                    </div>
                                </div>
                                <textarea 
                                    value={currentEp ? currentEp.content : ''} 
                                    onChange={(e) => handleContentChange(e.target.value)} 
                                    className="w-full flex-1 bg-transparent p-4 sm:p-8 text-slate-100 resize-none focus:outline-none leading-loose text-sm sm:text-base min-h-[500px]" 
                                    placeholder="본문을 입력하세요..."
                                ></textarea>
                            </div>
                        </div>
                    )}

                    {activeTab === 'timeline' && (
                        <div className="p-6 h-full overflow-y-auto max-w-5xl mx-auto w-full">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-bold text-slate-100">⏱️ 타임라인 보드</h2>
                                <select 
                                    value={timelineSort} 
                                    onChange={(e) => setTimelineSort(e.target.value)} 
                                    className="bg-[#111827] border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none"
                                >
                                    <option value="latest">최신순</option>
                                    <option value="oldest">오래된순</option>
                                    <option value="alphabet">가나다순</option>
                                </select>
                            </div>

                            <div className="bg-[#111827] p-4 rounded-xl border border-slate-800 mb-4 flex flex-col gap-2.5">
                                <input type="text" placeholder="구분 (예: 과거, 현재)" value={newTimeline.badge} onChange={e=>setNewTimeline({...newTimeline, badge:e.target.value})} className="bg-[#0b0f19] border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 w-full focus:outline-none" />
                                <input type="text" placeholder="사건 제목" value={newTimeline.title} onChange={e=>setNewTimeline({...newTimeline, title:e.target.value})} className="bg-[#0b0f19] border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 w-full focus:outline-none" />
                                <textarea placeholder="사건 내용 및 상세 설명 입력" value={newTimeline.desc} onChange={e=>setNewTimeline({...newTimeline, desc:e.target.value})} className="bg-[#0b0f19] border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 h-20 resize-none focus:outline-none" />
                                <button onClick={()=>{ if(newTimeline.title) { setTimelines([...timelines, {id: Date.now(), ...newTimeline}]); setNewTimeline({badge:'', title:'', desc:''}); } }} className="bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-lg text-xs font-semibold">타임라인 추가</button>
                            </div>

                            <div className="space-y-3">
                                {sortedTimelines.map(t => (
                                    <div key={t.id} className="bg-[#111827] p-4 rounded-xl border border-slate-800 relative">
                                        <span className="text-[10px] bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded border border-indigo-800">{t.badge || '일반'}</span>
                                        <h3 className="font-bold mt-2 text-sm text-slate-100">{t.title}</h3>
                                        <p className="text-xs text-slate-400 mt-1 whitespace-pre-wrap">{t.desc}</p>
                                        <button onClick={()=>setTimelines(timelines.filter(x=>x.id !== t.id))} className="absolute top-3 right-3 text-rose-400 text-xs">삭제</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'foreshadow' && (
                        <div className="p-6 h-full overflow-y-auto max-w-5xl mx-auto w-full">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-bold text-slate-100">🎣 복선 관리</h2>
                                <select 
                                    value={foreshadowSort} 
                                    onChange={(e) => setForeshadowSort(e.target.value)} 
                                    className="bg-[#111827] border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none"
                                >
                                    <option value="latest">최신순</option>
                                    <option value="oldest">오래된순</option>
                                    <option value="alphabet">가나다순</option>
                                </select>
                            </div>

                            <div className="bg-[#111827] p-4 rounded-xl border border-slate-800 mb-4 flex flex-col gap-2.5">
                                <input type="text" placeholder="구분 (예: 3화 던짐)" value={newForeshadow.badge} onChange={e=>setNewForeshadow({...newForeshadow, badge:e.target.value})} className="bg-[#0b0f19] border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 w-full focus:outline-none" />
                                <input type="text" placeholder="복선 제목" value={newForeshadow.title} onChange={e=>setNewForeshadow({...newForeshadow, title:e.target.value})} className="bg-[#0b0f19] border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 w-full focus:outline-none" />
                                <textarea placeholder="복선 내용 및 회수 목표 상세 설명" value={newForeshadow.desc} onChange={e=>setNewForeshadow({...newForeshadow, desc:e.target.value})} className="bg-[#0b0f19] border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 h-20 resize-none focus:outline-none" />
                                <button onClick={()=>{ if(newForeshadow.title) { setForeshadows([...foreshadows, {id: Date.now(), status:'미회수', ...newForeshadow}]); setNewForeshadow({badge:'', title:'', desc:''}); } }} className="bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-lg text-xs font-semibold">복선 등록</button>
                            </div>

                            <div className="space-y-3">
                                {sortedForeshadows.map(f => (
                                    <div key={f.id} className="bg-[#111827] p-4 rounded-xl border border-slate-800 relative flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-[10px] bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded border border-indigo-800">{f.badge || '일반'}</span>
                                                <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${f.status === '회수완료' ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-rose-950 text-rose-300 border-rose-800'}`}>{f.status}</span>
                                            </div>
                                            <h3 className="font-bold text-sm text-slate-100">{f.title}</h3>
                                            <p className="text-xs text-slate-400 mt-1 whitespace-pre-wrap">{f.desc}</p>
                                        </div>
                                        <div className="flex flex-col items-end gap-2 shrink-0">
                                            <button onClick={()=>setForeshadows(foreshadows.map(x=>x.id===f.id?{...x, status:x.status==='미회수'?'회수완료':'미회수'}:x))} className="bg-slate-800 text-[11px] text-slate-300 px-2.5 py-1 rounded border border-slate-700">상태변경</button>
                                            <button onClick={()=>setForeshadows(foreshadows.filter(x=>x.id!==f.id))} className="text-rose-400 text-xs">삭제</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'memo' && (
                        <div 
                            ref={memoContainerRef}
                            className={`relative bg-[#0b0f19] flex-1 overflow-auto ${isPanMode ? 'cursor-grab active:cursor-grabbing' : ''}`}
                            style={{ width: '100%', height: '100%', touchAction: 'none' }}
                            onMouseDown={handleContainerMouseDown}
                            onTouchStart={handleContainerTouchStart}
                        >
                            <div style={{ width: `${canvasSize.width}px`, height: `${canvasSize.height}px`, position: 'relative' }}>
                                <canvas
                                    ref={canvasRef}
                                    width={canvasSize.width}
                                    height={canvasSize.height}
                                    className={`absolute inset-0 z-0 ${isDrawingMode && !isPanMode ? 'pointer-events-auto cursor-crosshair' : 'pointer-events-none'}`}
                                    onMouseDown={startDrawing}
                                    onMouseMove={draw}
                                    onMouseUp={stopDrawing}
                                    onTouchStart={startDrawing}
                                    onTouchMove={draw}
                                    onTouchEnd={stopDrawing}
                                ></canvas>

                                <div 
                                    style={{ transform: `translate(${toolbarPos.x}px, ${toolbarPos.y}px)` }}
                                    className="absolute z-30 flex flex-wrap items-center gap-2 bg-[#111827] backdrop-blur p-2.5 rounded-xl border border-slate-700 shadow-2xl select-none"
                                >
                                    <span 
                                        className="text-xs font-bold text-indigo-300 px-1 cursor-move hover:text-indigo-200"
                                        onMouseDown={handleToolbarMouseDown}
                                        onTouchStart={handleToolbarTouchStart}
                                    >
                                        📌 툴바 (이동)
                                    </span>
                                    
                                    <div className="flex items-center space-x-1">
                                        {memoThemes.map((theme, idx) => (
                                            <button 
                                                key={idx} 
                                                onClick={() => addMemo(theme.class)} 
                                                className={`w-5 h-5 rounded-full border shadow-sm transition hover:scale-110 ${theme.class.split(' ')[0]}`}
                                                title={`${theme.name} 메모 추가`}
                                            ></button>
                                        ))}
                                    </div>
                                    
                                    <div className="h-4 w-[1px] bg-slate-700 mx-1"></div>

                                    <button 
                                        onClick={() => setIsPanMode(!isPanMode)} 
                                        className={`text-xs px-2.5 py-1 rounded font-semibold border ${isPanMode ? 'bg-amber-600 text-white border-amber-500' : 'bg-slate-800 text-slate-300 border-slate-700'}`}
                                        title="손바닥 모드 (화면 이동)"
                                    >
                                        ✋ {isPanMode ? '이동 켜짐' : '이동 끄기'}
                                    </button>

                                    <button 
                                        onClick={() => setIsDrawingMode(!isDrawingMode)} 
                                        className={`text-xs px-2.5 py-1 rounded font-semibold border ${isDrawingMode ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-800 text-slate-300 border-slate-700'}`}
                                    >
                                        {isDrawingMode ? '✏️ 그림 켜짐' : '🔒 그림 꺼짐'}
                                    </button>
                                    
                                    {isDrawingMode && (
                                        <div className="flex items-center space-x-2">
                                            <div className="flex items-center space-x-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
                                                <button onClick={() => setBrushColor('#ec4899')} className={`w-4 h-4 rounded-full bg-pink-500 ${brushColor === '#ec4899' ? 'ring-2 ring-white' : ''}`}></button>
                                                <button onClick={() => setBrushColor('#10b981')} className={`w-4 h-4 rounded-full bg-emerald-500 ${brushColor === '#10b981' ? 'ring-2 ring-white' : ''}`}></button>
                                                <button onClick={() => setBrushColor('#6366f1')} className={`w-4 h-4 rounded-full bg-indigo-500 ${brushColor === '#6366f1' ? 'ring-2 ring-white' : ''}`}></button>
                                                <button onClick={() => setBrushColor('#f59e0b')} className={`w-4 h-4 rounded-full bg-amber-500 ${brushColor === '#f59e0b' ? 'ring-2 ring-white' : ''}`}></button>
                                                <button onClick={() => setBrushColor('#ffffff')} className={`w-4 h-4 rounded-full bg-white ${brushColor === '#ffffff' ? 'ring-2 ring-slate-400' : ''}`}></button>
                                            </div>
                                            <button onClick={clearCanvas} className="bg-rose-950 text-rose-300 text-[11px] px-2 py-1 rounded border border-rose-800">지우기</button>
                                        </div>
                                    )}
                                </div>

                                {memos.map(memo => (
                                    <div
                                        key={memo.id}
                                        style={{ transform: `translate(${memo.x}px, ${memo.y}px)`, width: `${memo.w}px` }}
                                        className={`absolute z-10 ${memo.color} p-3 rounded-xl shadow-2xl flex flex-col gap-2`}
                                    >
                                        <div 
                                            className={`flex justify-between items-center border-b border-black/15 pb-1 ${isPanMode ? 'cursor-default' : 'cursor-move'}`}
                                            onMouseDown={(e) => handleMemoHeaderMouseDown(e, memo)}
                                            onTouchStart={(e) => handleMemoHeaderTouchStart(e, memo)}
                                        >
                                            <input 
                                                type="text" 
                                                value={memo.title} 
                                                onChange={(e) => updateMemoContent(memo.id, 'title', e.target.value)}
                                                className="bg-transparent font-bold text-xs w-full focus:outline-none cursor-text"
                                                onMouseDown={(e) => e.stopPropagation()}
                                                onTouchStart={(e) => e.stopPropagation()}
                                            />
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); deleteMemo(memo.id); }} 
                                                className="opacity-60 hover:opacity-100 text-xs px-1 font-bold shrink-0"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                        <textarea 
                                            value={memo.content} 
                                            onChange={(e) => updateMemoContent(memo.id, 'content', e.target.value)}
                                            className="bg-transparent text-xs resize-none h-24 focus:outline-none leading-relaxed"
                                        ></textarea>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {driveModalOpen && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-[#111827] border border-slate-700 rounded-2xl p-5 w-full max-w-md shadow-2xl flex flex-col max-h-[80vh]">
                        <h3 className="text-sm font-bold text-slate-100 mb-3">📁 구글 드라이브 백업 파일 목록</h3>
                        <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                            {driveFiles.length === 0 ? (
                                <p className="text-xs text-slate-400 text-center py-6">저장된 백업 파일이 없습니다.</p>
                            ) : (
                                driveFiles.map(file => (
                                    <div key={file.id} className="bg-[#0b0f19] p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                                        <span className="text-xs text-indigo-200 truncate pr-2">{file.name}</span>
                                        <button onClick={() => loadFromDriveFile(file.id)} className="bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] px-3 py-1.5 rounded-lg shrink-0 font-semibold">불러오기</button>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="flex justify-end">
                            <button onClick={() => setDriveModalOpen(false)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs font-semibold">닫기</button>
                        </div>
                    </div>
                </div>
            )}

            {resetModalOpen && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-[#111827] border border-slate-700 rounded-2xl p-6 w-full max-w-sm text-center shadow-2xl">
                        <h3 className="text-sm font-bold text-slate-100 mb-2">⚠️ 경고</h3>
                        <p className="text-xs text-slate-300 mb-5">진짜로 초기화 하시겠습니까?</p>
                        <div className="flex justify-center space-x-3">
                            <button onClick={() => setResetModalOpen(false)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-5 py-2 rounded-xl text-xs font-semibold">아니오</button>
                            <button onClick={executeReset} className="bg-rose-600 hover:bg-rose-500 text-white px-5 py-2 rounded-xl text-xs font-semibold">예</button>
                        </div>
                    </div>
                </div>
            )}

            {newEpModalOpen && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-[#111827] border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                        <h3 className="text-sm font-bold text-slate-100 mb-2">✨ 새 회차 추가</h3>
                        <p className="text-xs text-slate-400 mb-3">예: 2화. 혼돈이 우리를 기다린다</p>
                        <input 
                            type="text" 
                            placeholder="회차 제목 입력" 
                            value={newEpTitleInput}
                            onChange={(e) => setNewEpTitleInput(e.target.value)}
                            className="w-full bg-[#0b0f19] border border-slate-700 rounded-xl p-3 text-xs text-slate-200 mb-4 focus:outline-none"
                            autoFocus
                            onKeyDown={(e) => { if (e.key === 'Enter') confirmAddEpisode(); }}
                        />
                        <div className="flex justify-end space-x-2">
                            <button onClick={() => setNewEpModalOpen(false)} className="bg-slate-800 text-slate-300 px-3 py-1.5 rounded-xl text-xs">취소</button>
                            <button onClick={confirmAddEpisode} className="bg-indigo-600 text-white px-3 py-1.5 rounded-xl text-xs font-semibold">추가하기</button>
                        </div>
                    </div>
                </div>
            )}

            {lineSpacingModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-[#111827] border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                        <h3 className="text-sm font-bold text-slate-100 mb-3">⚙️ 줄바꿈 포맷터</h3>
                        <select value={spacingConfig.jiwun} onChange={(e) => setSpacingConfig({...spacingConfig, jiwun: Number(e.target.value)})} className="w-full bg-[#0b0f19] border border-slate-700 rounded-xl p-3 text-xs text-slate-200 mb-4 focus:outline-none">
                            <option value={1}>지문 사이 1줄</option>
                            <option value={2}>지문 사이 2줄</option>
                        </select>
                        <div className="flex justify-end space-x-2">
                            <button onClick={() => setLineSpacingModal(false)} className="bg-slate-800 text-slate-300 px-3 py-1.5 rounded-xl text-xs">취소</button>
                            <button onClick={applyLineSpacing} className="bg-indigo-600 text-white px-3 py-1.5 rounded-xl text-xs font-semibold">적용하기</button>
                        </div>
                    </div>
                </div>
            )}

            {backupModalOpen && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-[#111827] border border-slate-700 rounded-2xl p-5 w-full max-w-md shadow-2xl flex flex-col max-h-[80vh]">
                        <h3 className="text-sm font-bold text-slate-100 mb-2">💾 백업 데이터</h3>
                        <textarea readOnly value={backupJsonText} className="w-full h-48 bg-[#0b0f19] border border-slate-800 rounded-xl p-2.5 text-xs text-indigo-200 font-mono resize-none mb-3 focus:outline-none" />
                        <div className="flex justify-end space-x-2">
                            <button onClick={() => setBackupModalOpen(false)} className="bg-slate-800 text-slate-300 px-3 py-1.5 rounded-xl text-xs">닫기</button>
                            <button onClick={() => { navigator.clipboard.writeText(backupJsonText); alert("복사되었습니다!"); }} className="bg-indigo-600 text-white px-3 py-1.5 rounded-xl text-xs font-semibold">클립보드 복사</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

ReactDOM.render(<App />, document.getElementById('root'));
