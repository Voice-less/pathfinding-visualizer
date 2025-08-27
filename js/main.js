document.addEventListener('DOMContentLoaded', () => {
    
    //==================================================
    // 1. STATE MANAGEMENT & DOM REFERENCES
    //==================================================
    // DOM Elements
    const canvas = document.getElementById('path-canvas');
    const ctx = canvas.getContext('2d');
    const runBtn = document.getElementById('run-btn');
    const pauseResumeBtn = document.getElementById('pause-resume-btn');
    const stopBtn = document.getElementById('stop-btn');
    const mazeBtn = document.getElementById('maze-btn');
    const clearWallsBtn = document.getElementById('clear-walls-btn');
    const resetBoardBtn = document.getElementById('reset-board-btn');
    const visitedNodesBadge = document.getElementById('visited-nodes-badge');
    const pathLengthBadge = document.getElementById('path-length-badge');
    const timeTakenBadge = document.getElementById('time-taken-badge');
    const algorithmSelect = document.getElementById('algorithm-select');
    const speedSelect = document.getElementById('speed-select');
    
    // Application State
    let grid = [];
    let rows = 0, cols = 0;
    let maxRows = 0, maxCols = 0; // Maximum grid dimensions we've ever had
    let cellSize = 20; // The "zoom" level is now controlled by the cell size.
    let startNode = { x: 5, y: 5 }; // Store start node as state
    let endNode = { x: 35, y: 20 };  // Store end node as state
    let isDrawing = false;
    let isAnimating = false;
    let isPaused = false;
    let selectedAlgorithm = 'astar';
    let animationSpeed = 20;
    
    let animationRef = { stop: false, paused: false };
    
    //==================================================
    // 2. CORE LOGIC (NODE, COLORS, GRID INITIALIZATION
    //==================================================
    function createNode(x, y) {
        return { x, y, type: 'empty', g: Infinity, h: 0, f: Infinity, parent: null, neighbors: [] };
    }
    
    function getNodeColor(type) {
        switch (type) {
            case 'wall': return '#1f2937';
            case 'start': return '#10b981';
            case 'end': return '#ef4444';
            case 'visited': return '#3b82f6';
            case 'path': return '#f59e0b';
            default: return '#111827';
        }
    }
    
    function initializeGrid() {
        // If grid is empty or we need to expand it
        if (grid.length === 0 || rows > maxRows || cols > maxCols) {
            const newRows = Math.max(rows, maxRows);
            const newCols = Math.max(cols, maxCols);
            const newGrid = [];
            
            // Copy existing grid data if available
            if (grid.length > 0) {
                for (let y = 0; y < newRows; y++) {
                    const row = [];
                    for (let x = 0; x < newCols; x++) {
                        if (y < maxRows && x < maxCols && grid[y] && grid[y][x]) {
                            row.push(grid[y][x]);
                        } else {
                            row.push(createNode(x, y));
                        }
                    }
                    newGrid.push(row);
                }
            } else {
                // Create a new grid from scratch
                for (let y = 0; y < newRows; y++) {
                    const row = [];
                    for (let x = 0; x < newCols; x++) { 
                        row.push(createNode(x, y)); 
                    }
                    newGrid.push(row);
                }
            }
            
            grid = newGrid;
            maxRows = newRows;
            maxCols = newCols;
        }
        
        // Ensure start and end are within bounds
        startNode.x = Math.min(Math.max(0, startNode.x), maxCols - 1);
        startNode.y = Math.min(Math.max(0, startNode.y), maxRows - 1);
        endNode.x = Math.min(Math.max(0, endNode.x), maxCols - 1);
        endNode.y = Math.min(Math.max(0, endNode.y), maxRows - 1);
        
        grid[startNode.y][startNode.x].type = 'start';
        grid[endNode.y][endNode.x].type = 'end';
        
        // Update neighbors for all nodes
        for (let y = 0; y < maxRows; y++) {
            for (let x = 0; x < maxCols; x++) {
                const node = grid[y][x];
                node.neighbors = [];
                const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
                for (const [dx, dy] of directions) {
                    const nx = x + dx, ny = y + dy;
                    if (nx >= 0 && nx < maxCols && ny >= 0 && ny < maxRows) {
                        node.neighbors.push(grid[ny][nx]);
                    }
                }
            }
        }
    }
    
    //==================================================
    // 3. DRAWING LOGIC
    //==================================================
    
    function drawGrid() {
        requestAnimationFrame(() => {
            if (!ctx || !grid || !grid.length) {
                return;
            }
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Draw all cells in the grid
            for (let y = 0; y < rows; y++) {
                for (let x = 0; x < cols; x++) {
                    const node = grid[y][x];
                    ctx.fillStyle = getNodeColor(node.type);
                    ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
                }
            }
            
            // Draw grid lines only if they are large enough to be visible
            if (cellSize > 5) {
                ctx.strokeStyle = '#374151';
                ctx.lineWidth = 1;
                ctx.beginPath();
                for (let i = 0; i <= cols; i++) {
                    const xPos = i * cellSize;
                    ctx.moveTo(xPos, 0);
                    ctx.lineTo(xPos, rows * cellSize);
                }
                for (let i = 0; i <= rows; i++) {
                    const yPos = i * cellSize;
                    ctx.moveTo(0, yPos);
                    ctx.lineTo(cols * cellSize, yPos);
                }
                ctx.stroke();
            }
        });
    }
    
    //==================================================
    // 4. RESIZING & UI CONTROL FUNCTIONS
    //==================================================
    /**
     * Handles zoom by changing cell size and adjusting grid dimensions
     */
    function handleResize() {
        const container = document.getElementById('canvas-container');
        if (!container) return;
        
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        
        const newRows = Math.floor(canvas.height / cellSize);
        const newCols = Math.floor(canvas.width / cellSize);
        
        // Only proceed if dimensions actually changed
        if (newRows === rows && newCols === cols) {
            return;
        }
        
        // Update visible dimensions
        rows = newRows;
        cols = newCols;
        
        // Initialize or expand grid
        initializeGrid();
        
        // Redraw grid
        drawGrid();
    }
    
    function updateStats(visited = 0, path = 0, time = 0) {
        visitedNodesBadge.textContent = visited;
        pathLengthBadge.textContent = path;
        timeTakenBadge.textContent = `${time}ms`;
    }
    
    /**
     * Clears only the 'visited' and 'path' nodes, keeping walls and start/end nodes.
     */
    function clearPath() {
        // Don't stop animation when clearing path for a new run
        
        for (let y = 0; y < maxRows; y++) {
            for (let x = 0; x < maxCols; x++) {
                const node = grid[y][x];
                if (node.type === 'visited' || node.type === 'path') {
                    node.type = 'empty';
                }
                
                // Reset node properties for pathfinding
                node.g = Infinity; 
                node.h = 0; 
                node.f = Infinity; 
                node.parent = null;
            }
        }
        
        // Ensure start and end nodes are preserved
        grid[startNode.y][startNode.x].type = 'start';
        grid[endNode.y][endNode.x].type = 'end';
        
        drawGrid();
    }
    
    /**
     * Resets the entire board to a blank slate, clearing walls, paths, and stats.
     */
    function resetBoard() {
        stopAnimation();
        
        // Reset grid to current visible size
        maxRows = rows;
        maxCols = cols;
        
        // Reset start and end to default positions
        startNode = { x: 5, y: Math.floor(rows / 2) };
        endNode = { x: cols - 6, y: Math.floor(rows / 2) };
        
        // Ensure positions are within bounds
        startNode.x = Math.min(Math.max(0, startNode.x), maxCols - 1);
        startNode.y = Math.min(Math.max(0, startNode.y), maxRows - 1);
        endNode.x = Math.min(Math.max(0, endNode.x), maxCols - 1);
        endNode.y = Math.min(Math.max(0, endNode.y), maxRows - 1);
        
        // Create a completely fresh grid
        grid = [];
        initializeGrid();
        
        drawGrid();
        updateStats();
    }
    
    /**
     * Generates a random maze using the recursive backtracking algorithm.
     */
    function generateMaze() {
        stopAnimation();
        
        // Check if start or end nodes are outside the visible area
        let startOutsideVisible = startNode.x >= cols || startNode.y >= rows;
        let endOutsideVisible = endNode.x >= cols || endNode.y >= rows;
        
        // If either node is outside the visible area, reset positions
        if (startOutsideVisible || endOutsideVisible) {
            // Clear the existing start and end nodes
            if (grid.length > 0 && grid[startNode.y] && grid[startNode.y][startNode.x]) {
                grid[startNode.y][startNode.x].type = 'empty';
            }
            if (grid.length > 0 && grid[endNode.y] && grid[endNode.y][endNode.x]) {
                grid[endNode.y][endNode.x].type = 'empty';
            }
            
            // Reset to default positions within visible area
            startNode = { x: 5, y: Math.floor(rows / 2) };
            endNode = { x: cols - 6, y: Math.floor(rows / 2) };
            
            // Ensure positions are within bounds
            startNode.x = Math.min(Math.max(0, startNode.x), maxCols - 1);
            startNode.y = Math.min(Math.max(0, startNode.y), maxRows - 1);
            endNode.x = Math.min(Math.max(0, endNode.x), maxCols - 1);
            endNode.y = Math.min(Math.max(0, endNode.y), maxRows - 1);
        }
        
        // Fill the entire grid with walls
        for(let y = 0; y < maxRows; y++) {
            for(let x = 0; x < maxCols; x++) {
                grid[y][x].type = 'wall';
            }
        }
        
        // Generate maze only in the visible area
        const mazeRows = Math.min(rows, maxRows);
        const mazeCols = Math.min(cols, maxCols);
        
        const stack = [];
        const visited = new Set();
        let startX = 1, startY = 1;
        
        stack.push([startX, startY]);
        visited.add(`${startX},${startY}`);
        if(grid[startY]?.[startX]) grid[startY][startX].type = 'empty';
        const dirs = [[0, -2], [2, 0], [0, 2], [-2, 0]];
        while(stack.length > 0) {
            let [x, y] = stack[stack.length - 1];
            for(let i = dirs.length - 1; i > 0; i--){ 
                const j = Math.floor(Math.random() * (i + 1)); 
                [dirs[i], dirs[j]] = [dirs[j], dirs[i]]; 
            }
            let moved = false;
            for(const [dx, dy] of dirs) {
                const nx = x + dx, ny = y + dy;
                if(nx > 0 && nx < mazeCols - 1 && ny > 0 && ny < mazeRows - 1 && !visited.has(`${nx},${ny}`)) {
                    if(grid[ny]?.[nx]) grid[ny][nx].type = 'empty';
                    if(grid[y + dy / 2]?.[x + dx / 2]) grid[y + dy / 2][x + dx / 2].type = 'empty';
                    visited.add(`${nx},${ny}`);
                    stack.push([nx, ny]);
                    moved = true;
                    break;
                }
            }
            if(!moved) stack.pop();
        }
        
        // Re-apply the start and end nodes to ensure they are not overwritten
        grid[startNode.y][startNode.x].type = 'start';
        grid[endNode.y][endNode.x].type = 'end';
        
        drawGrid();
        updateStats();
    }
    
    //==================================================
    // 5. PATHFINDING ALGORITHMS
    //==================================================
    function findNodeByType(type) {
        for (let y = 0; y < maxRows; y++) {
            for (let x = 0; x < maxCols; x++) {
                if (grid[y][x].type === type) {
                    return grid[y][x];
                }
            }
        }
        return null; // Return null if not found
    }
    
    /**
     * Calculates the Manhattan distance heuristic for A*.
     */
    function heuristic(nodeA, nodeB) {
        return Math.abs(nodeA.x - nodeB.x) + Math.abs(nodeA.y - nodeB.y);
    }
    
    /**
     * Backtracks from a given end node to reconstruct the shortest path.
     */
    function reconstructPath(endNode) {
        const path = [];
        let currentNode = endNode;
        while (currentNode !== null) {
            path.unshift(currentNode);
            currentNode = currentNode.parent;
        }
        return path;
    }
    
    /**
     * Performs Breadth-First Search (BFS).
     */
    async function bfs(startNode, endNode) {
        const visitedNodesInOrder = [];
        const queue = [startNode];
        const visited = new Set();
        visited.add(startNode);
        
        while (queue.length > 0) {
            await pauseIfNecessary();
            if (animationRef.stop) return { path: [], visitedNodesInOrder };
            const currentNode = queue.shift();
            
            // Don't add start/end nodes to visited nodes for animation
            if (currentNode !== startNode && currentNode !== endNode) {
                visitedNodesInOrder.push(currentNode);
            }
            
            if (currentNode === endNode) {
                return { path: reconstructPath(endNode), visitedNodesInOrder };
            }
            
            for (const neighbor of currentNode.neighbors) {
                if (neighbor.type !== 'wall' && !visited.has(neighbor)) {
                    visited.add(neighbor);
                    neighbor.parent = currentNode;
                    queue.push(neighbor);
                }
            }
        }
        return { path: [], visitedNodesInOrder }; // No path found
    }
    
    /**
     * Performs Dijkstra's Algorithm.
     */
    async function dijkstra(startNode, endNode) {
        const visitedNodesInOrder = [];
        const unvisited = []; // This will act as a simple priority queue
        
        // Add all nodes to unvisited
        for (let y = 0; y < maxRows; y++) {
            for (let x = 0; x < maxCols; x++) {
                unvisited.push(grid[y][x]);
            }
        }
        
        // Set start node distance to 0
        startNode.g = 0;
        
        while (unvisited.length > 0) {
            await pauseIfNecessary();
            if (animationRef.stop) return { path: [], visitedNodesInOrder };
            
            // Sort by distance
            unvisited.sort((a, b) => a.g - b.g);
            const currentNode = unvisited.shift();
            
            // Skip walls
            if (currentNode.type === 'wall') continue;
            
            // If we can't reach this node, there's no path
            if (currentNode.g === Infinity) return { path: [], visitedNodesInOrder };
            
            // Don't add start/end nodes to visited nodes for animation
            if (currentNode !== startNode && currentNode !== endNode) {
                visitedNodesInOrder.push(currentNode);
            }
            
            if (currentNode === endNode) {
                return { path: reconstructPath(endNode), visitedNodesInOrder };
            }
            
            // Update distances to neighbors
            for (const neighbor of currentNode.neighbors) {
                if (neighbor.type !== 'wall') {
                    const tentativeG = currentNode.g + 1; // Assuming weight of 1
                    if (tentativeG < neighbor.g) {
                        neighbor.parent = currentNode;
                        neighbor.g = tentativeG;
                    }
                }
            }
        }
        return { path: [], visitedNodesInOrder }; // No path found
    }
    
    /**
     * Performs the A* (A-Star) search algorithm.
     */
    async function astar(startNode, endNode) {
        const visitedNodesInOrder = [];
        const openSet = [startNode];
        
        // Initialize start node
        startNode.g = 0;
        startNode.h = heuristic(startNode, endNode);
        startNode.f = startNode.g + startNode.h;
        
        while (openSet.length > 0) {
            await pauseIfNecessary();
            if (animationRef.stop) return { path: [], visitedNodesInOrder };
            
            // Get node with lowest f score
            openSet.sort((a, b) => a.f - b.f);
            const currentNode = openSet.shift();
            
            if (currentNode === endNode) {
                return { path: reconstructPath(endNode), visitedNodesInOrder };
            }
            
            // Don't add start/end nodes to visited nodes for animation
            if (currentNode !== startNode && currentNode !== endNode) {
                visitedNodesInOrder.push(currentNode);
            }
            
            for (const neighbor of currentNode.neighbors) {
                if (neighbor.type === 'wall') continue;
                
                const tentativeG = currentNode.g + 1;
                
                // If this path to neighbor is better
                if (tentativeG < neighbor.g) {
                    neighbor.parent = currentNode;
                    neighbor.g = tentativeG;
                    neighbor.h = heuristic(neighbor, endNode);
                    neighbor.f = neighbor.g + neighbor.h;
                    
                    // If neighbor not in open set, add it
                    if (!openSet.includes(neighbor)) {
                        openSet.push(neighbor);
                    }
                }
            }
        }
        return { path: [], visitedNodesInOrder }; // No path found
    }
    
    //==================================================
    // 6. ANIMATION & CONTROL LOGIC
    //==================================================
    
    async function pauseIfNecessary() {
        while (animationRef.paused && !animationRef.stop) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    async function animateVisitedNodes(visitedNodes) {
        for (const node of visitedNodes) {
            await pauseIfNecessary();
            if (animationRef.stop) return;
            
            // Don't change start/end nodes
            if (node.type !== 'start' && node.type !== 'end') {
                node.type = 'visited';
            }
            drawGrid();
            await new Promise(resolve => setTimeout(resolve, animationSpeed));
        }
    }
    
    async function animatePath(path) {
        for (const node of path) {
            await pauseIfNecessary();
            if (animationRef.stop) return;
            
            // Don't change start/end nodes
            if (node.type !== 'start' && node.type !== 'end') {
                node.type = 'path';
            }
            drawGrid();
            await new Promise(resolve => setTimeout(resolve, animationSpeed * 0.75));
        }
    }
    
    function stopAnimation(finished = false) {
        animationRef.stop = true;
        isAnimating = false;
        isPaused = false;
        runBtn.disabled = false;
        pauseResumeBtn.disabled = true;
        stopBtn.disabled = true;
        mazeBtn.disabled = false;
        clearWallsBtn.disabled = false;
        resetBoardBtn.disabled = false;
        pauseResumeBtn.textContent = 'Pause';
        runBtn.textContent = finished ? 'Visualize Again!' : 'Visualize!';
    }
    
    async function runAlgorithm() {
        if (isAnimating) return;
        
        isAnimating = true;
        isPaused = false;
        animationRef = { stop: false, paused: false };
        
        // Only clear visited and path nodes, preserve start/end
        clearPath();
        updateStats();
        
        runBtn.disabled = true;
        runBtn.textContent = 'Running...';
        pauseResumeBtn.disabled = false;
        stopBtn.disabled = false;
        mazeBtn.disabled = true;
        clearWallsBtn.disabled = true;
        resetBoardBtn.disabled = true;
        
        // Use our state variables instead of searching the grid
        const start = grid[startNode.y][startNode.x];
        const end = grid[endNode.y][endNode.x];
        
        if (!start || !end) {
            stopAnimation();
            return;
        }
        
        // Reset node properties for pathfinding
        for (let y = 0; y < maxRows; y++) {
            for (let x = 0; x < maxCols; x++) {
                const node = grid[y][x];
                node.g = Infinity;
                node.h = 0;
                node.f = Infinity;
                node.parent = null;
            }
        }
        
        const startTime = performance.now();
        let result = { path: [], visitedNodesInOrder: [] };
        
        switch (selectedAlgorithm) {
            case 'bfs': result = await bfs(start, end); break;
            case 'dijkstra': result = await dijkstra(start, end); break;
            case 'astar': result = await astar(start, end); break;
        }
        
        if (!animationRef.stop) {
            await animateVisitedNodes(result.visitedNodesInOrder);
            if (!animationRef.stop) {
                await animatePath(result.path);
            }
        }
        
        const endTime = performance.now();
        if (!animationRef.stop) {
           updateStats(result.visitedNodesInOrder.length, result.path.length, Math.round(endTime - startTime));
        }
        stopAnimation(true);
    }
    
    //==================================================
    // 7. EVENT LISTENERS & INITIALIZATION
    //==================================================
    
    function setupCustomSelects() {
        document.querySelectorAll('.custom-select').forEach(select => {
            const trigger = select.querySelector('.select-trigger');
            const options = select.querySelector('.select-options');
            const valueSpan = select.querySelector('span');
            trigger.addEventListener('click', (e) => { e.stopPropagation(); closeAllSelects(select); select.classList.toggle('active'); });
            
            options.querySelectorAll('.select-option').forEach(option => {
                option.addEventListener('click', () => {
                    valueSpan.textContent = option.textContent;
                    options.querySelector('.selected')?.classList.remove('selected');
                    option.classList.add('selected');
                    if (select.id === 'algorithm-select') { selectedAlgorithm = option.dataset.value; }
                    else if (select.id === 'speed-select') { animationSpeed = parseInt(option.dataset.value); }
                    select.classList.remove('active');
                });
            });
        });
        window.addEventListener('click', () => closeAllSelects());
    }
    
    function closeAllSelects(exceptThisOne = null) {
        document.querySelectorAll('.custom-select.active').forEach(select => {
            if (select !== exceptThisOne) select.classList.remove('active');
        });
    }
    
    runBtn.addEventListener('click', runAlgorithm);
    pauseResumeBtn.addEventListener('click', () => { 
        if (!isAnimating) return; 
        isPaused = !isPaused; 
        animationRef.paused = isPaused; 
        pauseResumeBtn.textContent = isPaused ? 'Resume' : 'Pause'; 
    });
    stopBtn.addEventListener('click', stopAnimation);
    mazeBtn.addEventListener('click', generateMaze);
    clearWallsBtn.addEventListener('click', clearPath);
    resetBoardBtn.addEventListener('click', resetBoard);
    
    canvas.addEventListener('mousedown', (e) => {
        if (isAnimating) return; 
        isDrawing = true;
        const rect = canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / cellSize);
        const y = Math.floor((e.clientY - rect.top) / cellSize);
        if (x < 0 || x >= cols || y < 0 || y >= rows) return;
        
        const node = grid[y][x];
        if (e.shiftKey && node.type !== 'end') {
            // Move start node
            grid[startNode.y][startNode.x].type = 'empty';
            startNode = { x, y };
            node.type = 'start';
        } else if ((e.ctrlKey || e.metaKey) && node.type !== 'start') {
            // Move end node
            grid[endNode.y][endNode.x].type = 'empty';
            endNode = { x, y };
            node.type = 'end';
        } else if (node.type === 'empty') {
            node.type = 'wall';
        } else if (node.type === 'wall') {
            node.type = 'empty';
        }
        drawGrid();
    });
    
    canvas.addEventListener('mousemove', (e) => {
        if (!isDrawing || isAnimating) return;
        const rect = canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / cellSize);
        const y = Math.floor((e.clientY - rect.top) / cellSize);
        if (x >= 0 && x < cols && y >= 0 && y < rows && grid[y][x].type === 'empty') {
            grid[y][x].type = 'wall'; 
            drawGrid();
        }
    });
    
    canvas.addEventListener('mouseup', () => isDrawing = false);
    canvas.addEventListener('mouseleave', () => isDrawing = false);
    
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const scaleAmount = e.deltaY > 0 ? 0.9 : 1.1;
        const newCellSize = Math.max(2, Math.min(cellSize * scaleAmount, 50));
        
        if (newCellSize.toFixed(1) !== cellSize.toFixed(1)) {
            cellSize = newCellSize;
            handleResize();
        }
    }, { passive: false });
    
    window.addEventListener('resize', handleResize);
    
    function initializeApp() {
        setupCustomSelects();
        
        // Set initial grid size based on container
        const container = document.getElementById('canvas-container');
        if (container) {
            rows = Math.floor(container.clientHeight / cellSize);
            cols = Math.floor(container.clientWidth / cellSize);
            
            // Set canvas size
            canvas.width = container.clientWidth;
            canvas.height = container.clientHeight;
        }
        
        // Initialize grid with the calculated dimensions
        initializeGrid();
        drawGrid();
    }
    
    initializeApp();
});