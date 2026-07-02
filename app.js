import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  getDatabase,
  ref,
  push,
  set,
  update,
  remove,
  onValue,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";
import { firebaseConfig } from "./firebase.config.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const todosRef = ref(db, "todos");

const todoForm = document.getElementById("todoForm");
const todoInput = document.getElementById("todoInput");
const todoList = document.getElementById("todoList");
const emptyMessage = document.getElementById("emptyMessage");
const totalCount = document.getElementById("totalCount");
const doneCount = document.getElementById("doneCount");

let todos = [];
let editingId = null;
let undoAction = null;
let undoTimer = null;

const UNDO_TIMEOUT = 5000;

function todoRef(id) {
  return ref(db, `todos/${id}`);
}

async function addTodo(text) {
  const trimmed = text.trim();
  if (!trimmed) return;

  const newRef = push(todosRef);
  await set(newRef, {
    text: trimmed,
    done: false,
    createdAt: Date.now(),
  });
}

async function deleteTodo(id) {
  const todo = todos.find((t) => t.id === id);
  if (!todo) return;

  if (editingId === id) editingId = null;

  await remove(todoRef(id));

  showUndo({
    type: "delete",
    todo: { id: todo.id, text: todo.text, done: todo.done, createdAt: todo.createdAt },
    message: "할일을 삭제했습니다.",
  });
}

async function toggleTodo(id) {
  const todo = todos.find((t) => t.id === id);
  if (!todo) return;

  const previousDone = todo.done;
  await update(todoRef(id), { done: !todo.done });

  showUndo({
    type: "toggle",
    todo: { id: todo.id, done: previousDone },
    message: previousDone ? "완료 표시를 취소했습니다." : "완료로 표시했습니다.",
  });
}

function startEdit(id) {
  editingId = id;
  render();
  const input = todoList.querySelector(`[data-edit-id="${id}"]`);
  if (input) {
    input.focus();
    input.select();
  }
}

async function saveEdit(id, newText) {
  const trimmed = newText.trim();
  const todo = todos.find((t) => t.id === id);

  if (!trimmed) {
    await deleteTodo(id);
    return;
  }

  if (todo && todo.text !== trimmed) {
    const previousText = todo.text;
    await update(todoRef(id), { text: trimmed });

    showUndo({
      type: "edit",
      todo: { id, text: previousText },
      message: "할일을 수정했습니다.",
    });
  }

  editingId = null;
  render();
}

function cancelEdit() {
  editingId = null;
  render();
}

async function performUndo() {
  if (!undoAction) return;

  const action = undoAction;
  clearUndo();

  if (action.type === "delete") {
    const { id, text, done, createdAt } = action.todo;
    await set(todoRef(id), { text, done, createdAt });
  } else if (action.type === "toggle") {
    await update(todoRef(action.todo.id), { done: action.todo.done });
  } else if (action.type === "edit") {
    await update(todoRef(action.todo.id), { text: action.todo.text });
  }
}

function showUndo(action) {
  clearUndo(false);
  undoAction = action;

  const toast = document.getElementById("undoToast");
  const message = document.getElementById("undoMessage");
  message.textContent = action.message;
  toast.classList.remove("hidden");

  undoTimer = setTimeout(clearUndo, UNDO_TIMEOUT);
}

function clearUndo(hideToast = true) {
  undoAction = null;
  if (undoTimer) {
    clearTimeout(undoTimer);
    undoTimer = null;
  }
  if (hideToast) {
    document.getElementById("undoToast").classList.add("hidden");
  }
}

function updateStats() {
  const total = todos.length;
  const done = todos.filter((t) => t.done).length;
  totalCount.textContent = `${total}개`;
  doneCount.textContent = `완료 ${done}`;
}

function render() {
  todoList.innerHTML = "";

  todos.forEach((todo) => {
    const li = document.createElement("li");
    li.className = "todo-item" + (todo.done ? " done" : "");
    li.dataset.id = todo.id;

    if (editingId === todo.id) {
      li.innerHTML = `
        <input type="checkbox" class="todo-checkbox" ${todo.done ? "checked" : ""} disabled>
        <input
          type="text"
          class="todo-edit-input"
          data-edit-id="${todo.id}"
          value="${escapeHtml(todo.text)}"
          maxlength="200"
        >
        <div class="todo-actions">
          <button type="button" class="btn-icon btn-delete" title="삭제">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      `;

      const editInput = li.querySelector(".todo-edit-input");
      let cancelingEdit = false;

      editInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          editInput.blur();
        }
        if (e.key === "Escape") {
          cancelingEdit = true;
          cancelEdit();
        }
      });

      editInput.addEventListener("blur", () => {
        if (cancelingEdit) {
          cancelingEdit = false;
          return;
        }
        saveEdit(todo.id, editInput.value);
      });

      li.querySelector(".btn-delete").addEventListener("click", () => deleteTodo(todo.id));
    } else {
      li.innerHTML = `
        <input type="checkbox" class="todo-checkbox" ${todo.done ? "checked" : ""}>
        <span class="todo-text" title="클릭하여 수정">${escapeHtml(todo.text)}</span>
        <div class="todo-actions">
          <button type="button" class="btn-icon btn-edit" title="수정">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button type="button" class="btn-icon btn-delete" title="삭제">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      `;

      li.querySelector(".todo-checkbox").addEventListener("change", () => toggleTodo(todo.id));
      li.querySelector(".todo-text").addEventListener("click", () => startEdit(todo.id));
      li.querySelector(".btn-edit").addEventListener("click", () => startEdit(todo.id));
      li.querySelector(".btn-delete").addEventListener("click", () => deleteTodo(todo.id));
    }

    todoList.appendChild(li);
  });

  emptyMessage.classList.toggle("hidden", todos.length > 0);
  updateStats();
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

todoForm.addEventListener("submit", (e) => {
  e.preventDefault();
  addTodo(todoInput.value);
  todoInput.value = "";
  todoInput.focus();
});

document.getElementById("undoBtn").addEventListener("click", performUndo);

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    e.preventDefault();
    performUndo();
  }
});

onValue(todosRef, (snapshot) => {
  const data = snapshot.val();

  todos = data
    ? Object.entries(data).map(([id, todo]) => ({ id, ...todo }))
    : [];

  todos.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  render();
});

window.__todoAppReady = true;
