'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { Card, Button, Modal, Form, Table, Badge, ButtonGroup } from 'react-bootstrap';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:5001';

// ----- helpers -----
const LS_KEY_GROUPS = 'mb_groups_v2_groupMultiplier';
const readLS = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } };
const writeLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

export default function Clients() {

  const BROKER = 'motilal';

  const [clients, setClients] = useState([]);
  const [selectedClients, setSelectedClients] = useState(new Set());
  const [subtab, setSubtab] = useState('clients');

  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const [addForm, setAddForm] = useState({
    name: '',
    userid: '',
    password: '',
    mpin: '',
    capital: ''
  });

  const [editingUserid, setEditingUserid] = useState(null);
  const [loggingNow, setLoggingNow] = useState(new Set());
  const pollingAbortRef = useRef(false);

  // Groups
  const [groups, setGroups] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState(new Set());
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editGroupMode, setEditGroupMode] = useState(false);

  const [groupForm, setGroupForm] = useState({
    id: null, name: '', multiplier: '1', members: {}
  });

  // ---------------- LOADERS ----------------

  async function loadClients() {
    try {
      const r = await fetch(`${API_BASE}/clients`, { cache: 'no-store' });
      const j = await r.json();
      setClients(Array.isArray(j) ? j : (j.clients || []));
    } catch {
      setClients([]);
    }
  }

  async function loadGroups() {
    try {
      const r = await fetch(`${API_BASE}/groups`, { cache: 'no-store' });
      if (r.ok) {
        const j = await r.json();
        const arr = Array.isArray(j) ? j : (j.groups || []);
        setGroups(arr);
        writeLS(LS_KEY_GROUPS, arr);
        return;
      }
      throw new Error();
    } catch {
      setGroups(readLS(LS_KEY_GROUPS, []));
    }
  }

  useEffect(() => { loadClients(); loadGroups(); }, []);

  // ---------------- HELPERS ----------------

  const keyOf = (c) => `motilal::${c.userid || c.client_id}`;
  const allClientKeys = useMemo(() => clients.map(keyOf), [clients]);

  const toggleAllClients = (ch) =>
    setSelectedClients(ch ? new Set(allClientKeys) : new Set());

  const toggleOneClient = (k, ch) =>
    setSelectedClients(p => { const s = new Set(p); ch ? s.add(k) : s.delete(k); return s; });

  const statusBadge = (c) => {
    const k = keyOf(c);
    if (loggingNow.has(k)) return <Badge bg="warning">logging…</Badge>;
    const s = c.session_active ? 'logged_in' : 'logged_out';
    return <Badge bg={s === 'logged_in' ? 'success' : 'secondary'}>{s}</Badge>;
  };

  // ---------------- CLIENT MODAL ----------------

  const openAdd = () => {
    setEditMode(false);
    setAddForm({ name: '', userid: '', password: '', mpin: '', capital: '' });
    setEditingUserid(null);
    setShowModal(true);
  };

  const openEdit = () => {
    if (selectedClients.size !== 1) return;
    const k = [...selectedClients][0];
    const row = clients.find(c => keyOf(c) === k);
    if (!row) return;

    setEditMode(true);
    setAddForm({
      name: row.name || '',
      userid: row.userid,
      password: '',
      mpin: '',
      capital: row.capital?.toString?.() || ''
    });
    setEditingUserid(row.userid);
    setShowModal(true);
  };

  const onDelete = async () => {
    if (!selectedClients.size) return;
    if (!confirm(`Delete ${selectedClients.size} client(s)?`)) return;

    const items = [...selectedClients].map(k => {
      const id = k.split('::')[1];
      return { broker: BROKER, userid: id };
    });

    await fetch(`${API_BASE}/delete_client`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    });

    await loadClients();
    setSelectedClients(new Set());
  };

  const onSubmit = async (e) => {
    e.preventDefault();

    if (!addForm.userid || !addForm.password || !addForm.mpin) {
      alert('Client ID, Password and MPIN are required');
      return;
    }

    const payload = {
      broker: BROKER,
      userid: addForm.userid,
      name: addForm.name || undefined,
      capital: addForm.capital ? Number(addForm.capital) : undefined,
      password: addForm.password,
      mpin: addForm.mpin
    };

    if (editMode && editingUserid) {
      payload.original_userid = editingUserid;
    }

    const endpoint = editMode ? 'edit_client' : 'add_client';

    await fetch(`${API_BASE}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    setShowModal(false);
    setSelectedClients(new Set());
    await loadClients();
  };

  // ---------------- UI ----------------

  return (
    <Card className="p-3">

      <div className="d-flex mb-3 gap-2">
        <Button variant="success" onClick={openAdd}>Add Client</Button>
        <Button variant="secondary" disabled={selectedClients.size !== 1} onClick={openEdit}>Edit</Button>
        <Button variant="danger" disabled={!selectedClients.size} onClick={onDelete}>Delete</Button>
        <div className="ms-auto">
          <Button variant="outline-secondary" onClick={() => { loadClients(); loadGroups(); }}>
            Refresh
          </Button>
        </div>
      </div>

      <Table bordered hover responsive size="sm">
        <thead>
          <tr>
            <th style={{ width: 60 }}>
              <Form.Check
                checked={selectedClients.size === clients.length && clients.length > 0}
                onChange={(e) => toggleAllClients(e.target.checked)}
              />
            </th>
            <th>Name</th>
            <th>Client ID</th>
            <th>Capital</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {clients.length === 0 ? (
            <tr><td colSpan={5} className="text-muted">No clients yet.</td></tr>
          ) : clients.map(c => {
            const k = keyOf(c);
            return (
              <tr key={k}>
                <td>
                  <Form.Check
                    checked={selectedClients.has(k)}
                    onChange={(e) => toggleOneClient(k, e.target.checked)}
                  />
                </td>
                <td>{c.name || '-'}</td>
                <td>{c.userid}</td>
                <td>{c.capital ?? '-'}</td>
                <td>{statusBadge(c)}</td>
              </tr>
            );
          })}
        </tbody>
      </Table>

      {/* Add/Edit Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Form onSubmit={onSubmit}>
          <Modal.Header closeButton>
            <Modal.Title>{editMode ? 'Edit Client' : 'Add Client'} (Motilal)</Modal.Title>
          </Modal.Header>
          <Modal.Body>

            <Form.Group className="mb-2">
              <Form.Label>Name</Form.Label>
              <Form.Control value={addForm.name}
                onChange={(e) => setAddForm(p => ({ ...p, name: e.target.value }))} />
            </Form.Group>

            <Form.Group className="mb-2">
              <Form.Label>Client ID *</Form.Label>
              <Form.Control required disabled={editMode}
                value={addForm.userid}
                onChange={(e) => setAddForm(p => ({ ...p, userid: e.target.value.trim() }))} />
            </Form.Group>

            <Form.Group className="mb-2">
              <Form.Label>Password *</Form.Label>
              <Form.Control type="password" required
                onChange={(e) => setAddForm(p => ({ ...p, password: e.target.value }))} />
            </Form.Group>

            <Form.Group className="mb-2">
              <Form.Label>MPIN *</Form.Label>
              <Form.Control type="password" required
                onChange={(e) => setAddForm(p => ({ ...p, mpin: e.target.value }))} />
            </Form.Group>

            <Form.Group className="mb-2">
              <Form.Label>Capital</Form.Label>
              <Form.Control type="number"
                value={addForm.capital}
                onChange={(e) => setAddForm(p => ({ ...p, capital: e.target.value }))} />
            </Form.Group>

          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" variant="primary">Save & Login</Button>
          </Modal.Footer>
        </Form>
      </Modal>

    </Card>
  );
}
