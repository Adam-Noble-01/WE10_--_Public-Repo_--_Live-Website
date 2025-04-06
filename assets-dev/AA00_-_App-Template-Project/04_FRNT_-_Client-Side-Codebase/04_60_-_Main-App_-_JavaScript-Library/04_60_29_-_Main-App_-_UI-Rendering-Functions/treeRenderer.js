import { formatBytes } from '../04_60_03_-_Main-App_-_Global-Helper-Functions/formatBytes.js';

/**
 * Renders a tree structure for directory/file visualization
 * @param {Array} nodeDataArray - Array of node data objects to render
 * @returns {HTMLElement} - A UL element containing the rendered tree
 */
function renderTree(nodeDataArray) {
    const ul = document.createElement('ul');
    
    nodeDataArray.forEach(item => {
        const li = document.createElement('li');
        const nodeDiv = document.createElement('div');
        nodeDiv.classList.add('tree-node', item.type);

        if (item.type === 'folder') {
            li.classList.add('expanded');
            nodeDiv.classList.add('expanded');

            nodeDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                li.classList.toggle('expanded');
                nodeDiv.classList.toggle('expanded');
                const isExpanded = li.classList.contains('expanded');
                nodeDiv.setAttribute('aria-expanded', isExpanded.toString());
                const childUl = li.querySelector('ul');
                if (childUl) {
                    childUl.style.display = isExpanded ? 'block' : 'none';
                }
            });
            
            nodeDiv.setAttribute('role', 'treeitem');
            nodeDiv.setAttribute('aria-expanded', 'true');
        } else {
            nodeDiv.setAttribute('role', 'treeitem');
        }

        const iconSpan = document.createElement('span');
        iconSpan.classList.add('icon');
        iconSpan.setAttribute('aria-hidden', 'true');
        iconSpan.textContent = item.type === 'folder' ? '📁' : '📄';
        nodeDiv.appendChild(iconSpan);

        const nameSpan = document.createElement('span');
        nameSpan.classList.add('name');
        nameSpan.textContent = item.name;
        nodeDiv.appendChild(nameSpan);

        if (item.size !== undefined) {
            const sizeSpan = document.createElement('span');
            sizeSpan.classList.add('size');
            sizeSpan.textContent = `(${formatBytes(item.size)})`;
            nodeDiv.appendChild(sizeSpan);
        }

        if (item.warning) {
            const warningSpan = document.createElement('span');
            warningSpan.classList.add('warning');
            warningSpan.textContent = `[!] ${item.warning}`;
            nodeDiv.appendChild(warningSpan);
        }
        
        if (item.error) {
            const errorSpan = document.createElement('span');
            errorSpan.classList.add('error');
            errorSpan.textContent = `[Error] ${item.error}`;
            nodeDiv.appendChild(errorSpan);
        }

        li.appendChild(nodeDiv);

        if (item.type === 'folder' && item.children && item.children.length > 0) {
            const childUl = renderTree(item.children);
            childUl.style.display = 'block';
            li.appendChild(childUl);
        }
        
        ul.appendChild(li);
    });
    
    return ul;
}

/**
 * Creates a root tree node and renders the entire tree structure
 * @param {Object} rootData - Data for the root node
 * @param {HTMLElement} container - Container element to append the tree to
 */
function renderDirectoryTree(rootData, container) {
    container.innerHTML = ''; // Clear container
    
    if (!rootData || typeof rootData !== 'object') {
        container.innerHTML = '<p>No valid data structure received.</p>';
        return;
    }
    
    const rootUl = document.createElement('ul');
    rootUl.setAttribute('role', 'tree');
    rootUl.setAttribute('aria-label', 'Directory Scan Results');

    const rootLi = document.createElement('li');
    const rootDiv = document.createElement('div');
    rootDiv.classList.add('tree-node', 'folder', 'expanded');
    rootDiv.setAttribute('role', 'treeitem');
    rootDiv.setAttribute('aria-expanded', 'true');

    rootDiv.innerHTML = `<span class="icon" aria-hidden="true">📁</span> <span class="name">${rootData.name || 'Root'}</span> <span class="size">(${formatBytes(rootData.size)})</span>`;
    
    if (rootData.warning) {
        rootDiv.innerHTML += ` <span class="warning">[!] ${rootData.warning}</span>`;
    }
    
    if (rootData.error) {
        rootDiv.innerHTML += ` <span class="error">[Error] ${rootData.error}</span>`;
    }

    rootDiv.addEventListener('click', (e) => {
        e.stopPropagation();
        rootLi.classList.toggle('expanded');
        rootDiv.classList.toggle('expanded');
        const isExpanded = rootLi.classList.contains('expanded');
        rootDiv.setAttribute('aria-expanded', isExpanded.toString());
        const childUl = rootLi.querySelector('ul');
        if (childUl) {
            childUl.style.display = isExpanded ? 'block' : 'none';
        }
    });

    rootLi.appendChild(rootDiv);
    rootLi.classList.add('expanded');

    if (rootData.children && rootData.children.length > 0) {
        const childUl = renderTree(rootData.children);
        childUl.style.display = 'block';
        rootLi.appendChild(childUl);
    }

    rootUl.appendChild(rootLi);
    container.appendChild(rootUl);
}

export { renderTree, renderDirectoryTree }; 