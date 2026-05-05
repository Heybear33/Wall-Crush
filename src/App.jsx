import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  Trophy,
  UserRound,
} from "lucide-react";
import { adminEmails, isSupabaseConfigured, supabase } from "./lib/supabase";

const emptyRunner = {
  name: "",
  email: "",
  phone: "",
  ten_k_record: "",
  half_record: "",
  full_record: "",
  goal_race: "",
  goal_record: "",
  injured: false,
  memo: "",
};

const emptyRace = {
  title: "",
  race_date: "",
  distance: "10km",
  location: "",
  target_record: "",
  memo: "",
};

const attendanceDays = ["tue", "thu"];

function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [runners, setRunners] = useState([]);
  const [attendances, setAttendances] = useState([]);
  const [races, setRaces] = useState([]);
  const [runnerForm, setRunnerForm] = useState(emptyRunner);
  const [raceForm, setRaceForm] = useState(emptyRace);
  const [editingRunnerId, setEditingRunnerId] = useState(null);
  const [editingRaceId, setEditingRaceId] = useState(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const user = session?.user;
  const isAdmin = Boolean(
    user?.email && adminEmails.includes(user.email.toLowerCase())
  );

  const visibleRunners = useMemo(() => {
    if (isAdmin) return runners;
    return runners.filter(
      (runner) => runner.email?.toLowerCase() === user?.email?.toLowerCase()
    );
  }, [isAdmin, runners, user?.email]);

  const currentRunner = visibleRunners[0];

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      loadDashboard();
    }
  }, [user?.id]);

  async function loadDashboard() {
    if (!supabase) return;
    setIsLoading(true);
    setMessage("");

    const [runnerResult, attendanceResult, raceResult] = await Promise.all([
      supabase.from("runners").select("*").order("name"),
      supabase.from("attendances").select("*").order("checked_at", {
        ascending: false,
      }),
      supabase.from("races").select("*").order("race_date"),
    ]);

    const error =
      runnerResult.error || attendanceResult.error || raceResult.error;
    if (error) {
      setMessage(error.message);
    } else {
      setRunners(runnerResult.data || []);
      setAttendances(attendanceResult.data || []);
      setRaces(raceResult.data || []);
    }

    setIsLoading(false);
  }

  async function signInWithGoogle() {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  async function saveRunner(event) {
    event.preventDefault();
    if (!isAdmin || !supabase) return;

    const payload = {
      ...runnerForm,
      email: runnerForm.email.trim().toLowerCase(),
      updated_at: new Date().toISOString(),
    };

    const result = editingRunnerId
      ? await supabase.from("runners").update(payload).eq("id", editingRunnerId)
      : await supabase.from("runners").insert(payload);

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    setRunnerForm(emptyRunner);
    setEditingRunnerId(null);
    await loadDashboard();
  }

  async function deleteRunner(id) {
    if (!isAdmin || !supabase) return;
    const { error } = await supabase.from("runners").delete().eq("id", id);
    if (error) setMessage(error.message);
    await loadDashboard();
  }

  async function saveRace(event) {
    event.preventDefault();
    if (!isAdmin || !supabase) return;

    const result = editingRaceId
      ? await supabase.from("races").update(raceForm).eq("id", editingRaceId)
      : await supabase.from("races").insert(raceForm);

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    setRaceForm(emptyRace);
    setEditingRaceId(null);
    await loadDashboard();
  }

  async function deleteRace(id) {
    if (!isAdmin || !supabase) return;
    const { error } = await supabase.from("races").delete().eq("id", id);
    if (error) setMessage(error.message);
    await loadDashboard();
  }

  async function toggleAttendance(runnerId, dayType) {
    if (!isAdmin || !supabase) return;

    const today = new Date().toISOString().slice(0, 10);
    const existing = attendances.find(
      (item) =>
        item.runner_id === runnerId &&
        item.checked_at === today &&
        item.day_type === dayType
    );

    const result = existing
      ? await supabase.from("attendances").delete().eq("id", existing.id)
      : await supabase.from("attendances").insert({
          runner_id: runnerId,
          checked_at: today,
          day_type: dayType,
        });

    if (result.error) setMessage(result.error.message);
    await loadDashboard();
  }

  function editRunner(runner) {
    setEditingRunnerId(runner.id);
    setRunnerForm({
      name: runner.name || "",
      email: runner.email || "",
      phone: runner.phone || "",
      ten_k_record: runner.ten_k_record || "",
      half_record: runner.half_record || "",
      full_record: runner.full_record || "",
      goal_race: runner.goal_race || "",
      goal_record: runner.goal_record || "",
      injured: Boolean(runner.injured),
      memo: runner.memo || "",
    });
  }

  function editRace(race) {
    setEditingRaceId(race.id);
    setRaceForm({
      title: race.title || "",
      race_date: race.race_date || "",
      distance: race.distance || "10km",
      location: race.location || "",
      target_record: race.target_record || "",
      memo: race.memo || "",
    });
  }

  if (authLoading) {
    return <Shell centerText="로그인 상태를 확인하는 중입니다." />;
  }

  if (!isSupabaseConfigured) {
    return (
      <Shell>
        <section className="login-panel">
          <ShieldCheck size={44} />
          <h1>Supabase 설정이 필요합니다</h1>
          <p>.env 파일에 Supabase URL과 anon key를 입력하면 로그인 화면이 열립니다.</p>
        </section>
      </Shell>
    );
  }

  if (!user) {
    return (
      <Shell>
        <section className="login-panel">
          <div className="brand-mark">벽깨자</div>
          <h1>러너 관리 시스템</h1>
          <p>운영진과 멤버 모두 Google 계정으로 로그인합니다.</p>
          <button className="primary-action" onClick={signInWithGoogle}>
            <LogIn size={18} />
            Google로 로그인
          </button>
        </section>
      </Shell>
    );
  }

  return (
    <Shell>
      <header className="topbar">
        <div>
          <span className="eyebrow">Byeokgaeja Runner Ops</span>
          <h1>벽깨자 러너 관리</h1>
        </div>
        <div className="account">
          <span>{user.email}</span>
          <strong>{isAdmin ? "관리자" : "멤버"}</strong>
          <button className="icon-button" onClick={signOut} title="로그아웃">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {message && <div className="notice">{message}</div>}

      <main className="dashboard">
        <section className="summary-strip">
          <Metric icon={<UserRound />} label="러너" value={visibleRunners.length} />
          <Metric
            icon={<CheckCircle2 />}
            label="월간 출석률"
            value={`${monthlyRate(attendances, currentRunner?.id)}%`}
          />
          <Metric icon={<Trophy />} label="예정 대회" value={races.length} />
        </section>

        {isAdmin && (
          <section className="ops-grid">
            <RunnerForm
              form={runnerForm}
              setForm={setRunnerForm}
              editingId={editingRunnerId}
              onSubmit={saveRunner}
              onCancel={() => {
                setRunnerForm(emptyRunner);
                setEditingRunnerId(null);
              }}
            />
            <RaceForm
              form={raceForm}
              setForm={setRaceForm}
              editingId={editingRaceId}
              onSubmit={saveRace}
              onCancel={() => {
                setRaceForm(emptyRace);
                setEditingRaceId(null);
              }}
            />
          </section>
        )}

        <section className="content-grid">
          <div className="panel wide">
            <PanelTitle icon={<ClipboardList />} title="러너 기록" />
            <div className="runner-list">
              {visibleRunners.map((runner) => (
                <RunnerCard
                  key={runner.id}
                  runner={runner}
                  isAdmin={isAdmin}
                  attendanceRate={monthlyRate(attendances, runner.id)}
                  attendances={attendances}
                  onEdit={() => editRunner(runner)}
                  onDelete={() => deleteRunner(runner.id)}
                  onAttendance={toggleAttendance}
                />
              ))}
              {!visibleRunners.length && (
                <p className="empty-text">
                  등록된 러너 정보가 없습니다. 관리자가 Google 계정 이메일로 러너를
                  등록해야 멤버 화면에 표시됩니다.
                </p>
              )}
            </div>
          </div>

          <div className="panel">
            <PanelTitle icon={<CalendarDays />} title="대회 일정" />
            <div className="race-list">
              {races.map((race) => (
                <article className="race-item" key={race.id}>
                  <div>
                    <strong>{race.title}</strong>
                    <span>
                      {race.race_date || "날짜 미정"} · {race.distance}
                    </span>
                    <small>{race.location}</small>
                  </div>
                  {isAdmin && (
                    <div className="row-actions">
                      <button onClick={() => editRace(race)} title="대회 수정">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => deleteRace(race.id)} title="대회 삭제">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </article>
              ))}
              {!races.length && <p className="empty-text">등록된 대회가 없습니다.</p>}
            </div>
          </div>
        </section>
      </main>

      {isLoading && <div className="loading">데이터를 불러오는 중입니다.</div>}
    </Shell>
  );
}

function Shell({ children, centerText }) {
  return (
    <div className="app-shell">
      {centerText ? <div className="center-text">{centerText}</div> : children}
    </div>
  );
}

function Metric({ icon, label, value }) {
  return (
    <article className="metric">
      <div>{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function PanelTitle({ icon, title }) {
  return (
    <div className="panel-title">
      {icon}
      <h2>{title}</h2>
    </div>
  );
}

function RunnerForm({ form, setForm, editingId, onSubmit, onCancel }) {
  return (
    <form className="panel form-panel" onSubmit={onSubmit}>
      <PanelTitle icon={<Plus />} title={editingId ? "러너 수정" : "러너 등록"} />
      <div className="form-grid">
        <input
          required
          placeholder="이름"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          required
          type="email"
          placeholder="Google 계정 이메일"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <input
          placeholder="연락처"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <input
          placeholder="10km 기록"
          value={form.ten_k_record}
          onChange={(e) => setForm({ ...form, ten_k_record: e.target.value })}
        />
        <input
          placeholder="하프 기록"
          value={form.half_record}
          onChange={(e) => setForm({ ...form, half_record: e.target.value })}
        />
        <input
          placeholder="풀코스 기록"
          value={form.full_record}
          onChange={(e) => setForm({ ...form, full_record: e.target.value })}
        />
        <input
          placeholder="목표 대회"
          value={form.goal_race}
          onChange={(e) => setForm({ ...form, goal_race: e.target.value })}
        />
        <input
          placeholder="목표 기록"
          value={form.goal_record}
          onChange={(e) => setForm({ ...form, goal_record: e.target.value })}
        />
      </div>
      <label className="check-row">
        <input
          type="checkbox"
          checked={form.injured}
          onChange={(e) => setForm({ ...form, injured: e.target.checked })}
        />
        부상 있음
      </label>
      <textarea
        placeholder="메모"
        value={form.memo}
        onChange={(e) => setForm({ ...form, memo: e.target.value })}
      />
      <div className="button-row">
        <button className="primary-action" type="submit">
          저장
        </button>
        {editingId && (
          <button className="secondary-action" type="button" onClick={onCancel}>
            취소
          </button>
        )}
      </div>
    </form>
  );
}

function RaceForm({ form, setForm, editingId, onSubmit, onCancel }) {
  return (
    <form className="panel form-panel" onSubmit={onSubmit}>
      <PanelTitle icon={<Trophy />} title={editingId ? "대회 수정" : "대회 등록"} />
      <div className="form-grid">
        <input
          required
          placeholder="대회명"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <input
          type="date"
          value={form.race_date}
          onChange={(e) => setForm({ ...form, race_date: e.target.value })}
        />
        <select
          value={form.distance}
          onChange={(e) => setForm({ ...form, distance: e.target.value })}
        >
          <option>10km</option>
          <option>하프</option>
          <option>풀코스</option>
          <option>기타</option>
        </select>
        <input
          placeholder="장소"
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
        />
        <input
          placeholder="목표 기록"
          value={form.target_record}
          onChange={(e) => setForm({ ...form, target_record: e.target.value })}
        />
      </div>
      <textarea
        placeholder="메모"
        value={form.memo}
        onChange={(e) => setForm({ ...form, memo: e.target.value })}
      />
      <div className="button-row">
        <button className="primary-action" type="submit">
          저장
        </button>
        {editingId && (
          <button className="secondary-action" type="button" onClick={onCancel}>
            취소
          </button>
        )}
      </div>
    </form>
  );
}

function RunnerCard({
  runner,
  isAdmin,
  attendanceRate,
  attendances,
  onEdit,
  onDelete,
  onAttendance,
}) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <article className="runner-card">
      <div className="runner-heading">
        <div>
          <h3>{runner.name}</h3>
          <span>{runner.email}</span>
        </div>
        {runner.injured && <strong className="injury">부상 관리</strong>}
      </div>
      <dl className="record-grid">
        <Record label="10km" value={runner.ten_k_record} />
        <Record label="하프" value={runner.half_record} />
        <Record label="풀코스" value={runner.full_record} />
        <Record label="목표 대회" value={runner.goal_race} />
        <Record label="목표 기록" value={runner.goal_record} />
        <Record label="월간 출석률" value={`${attendanceRate}%`} />
      </dl>
      {runner.memo && <p className="memo">{runner.memo}</p>}
      {isAdmin && (
        <div className="runner-actions">
          <div className="attendance-actions">
            {attendanceDays.map((day) => {
              const checked = attendances.some(
                (item) =>
                  item.runner_id === runner.id &&
                  item.checked_at === today &&
                  item.day_type === day
              );
              return (
                <button
                  key={day}
                  className={checked ? "attendance checked" : "attendance"}
                  onClick={() => onAttendance(runner.id, day)}
                >
                  {day === "tue" ? "화" : "목"}
                </button>
              );
            })}
          </div>
          <div className="row-actions">
            <button onClick={onEdit} title="러너 수정">
              <Pencil size={16} />
            </button>
            <button onClick={onDelete} title="러너 삭제">
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

function Record({ label, value }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || "-"}</dd>
    </div>
  );
}

function monthlyRate(attendances, runnerId) {
  if (!runnerId) return 0;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const trainingDays = countTrainingDays(year, month);
  if (!trainingDays) return 0;

  const attended = new Set(
    attendances
      .filter((item) => {
        const date = new Date(item.checked_at);
        return (
          item.runner_id === runnerId &&
          date.getFullYear() === year &&
          date.getMonth() === month
        );
      })
      .map((item) => `${item.checked_at}-${item.day_type}`)
  ).size;

  return Math.round((attended / trainingDays) * 100);
}

function countTrainingDays(year, month) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  let count = 0;

  for (let day = 1; day <= lastDay; day += 1) {
    const weekday = new Date(year, month, day).getDay();
    if (weekday === 2 || weekday === 4) count += 1;
  }

  return count;
}

export default App;
