import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  LogIn,
  LogOut,
  MapPin,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  Trophy,
  UserRound,
  Users,
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
  location: "",
};

const emptyTraining = {
  title: "",
  training_date: "",
  training_time: "",
  location: "",
  memo: "",
};

const attendanceDays = ["tue", "thu"];

function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [runners, setRunners] = useState([]);
  const [attendances, setAttendances] = useState([]);
  const [races, setRaces] = useState([]);
  const [trainings, setTrainings] = useState([]);
  const [trainingParticipants, setTrainingParticipants] = useState([]);
  const [runnerForm, setRunnerForm] = useState(emptyRunner);
  const [myRunnerForm, setMyRunnerForm] = useState(emptyRunner);
  const [raceForm, setRaceForm] = useState(emptyRace);
  const [trainingForm, setTrainingForm] = useState(emptyTraining);
  const [editingRunnerId, setEditingRunnerId] = useState(null);
  const [editingRaceId, setEditingRaceId] = useState(null);
  const [editingTrainingId, setEditingTrainingId] = useState(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const user = session?.user;
  const userEmail = user?.email?.toLowerCase();
  const isAdmin = Boolean(userEmail && adminEmails.includes(userEmail));

  const myRunner = useMemo(
    () => runners.find((runner) => runner.email?.toLowerCase() === userEmail),
    [runners, userEmail]
  );

  const visibleRunners = useMemo(() => {
    if (isAdmin) return runners;
    return myRunner ? [myRunner] : [];
  }, [isAdmin, myRunner, runners]);

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
    if (!authLoading) {
      loadDashboard();
    }
  }, [authLoading, user?.id]);

  useEffect(() => {
    if (myRunner) {
      setMyRunnerForm(runnerToForm(myRunner));
    } else if (user?.email) {
      setMyRunnerForm({
        ...emptyRunner,
        name: user.user_metadata?.full_name || "",
        email: user.email,
      });
    } else {
      setMyRunnerForm(emptyRunner);
    }
  }, [myRunner, user?.email, user?.user_metadata?.full_name]);

  async function loadDashboard() {
    if (!supabase) return;
    setIsLoading(true);
    setMessage("");

    const publicQueries = [
      supabase
        .from("training_schedules")
        .select("*")
        .order("training_date")
        .order("training_time"),
      supabase.from("races").select("*").order("race_date"),
    ];

    const privateQueries = user
      ? [
          supabase.from("runners").select("*").order("name"),
          supabase.from("attendances").select("*").order("checked_at", {
            ascending: false,
          }),
          supabase.from("training_participants").select("*"),
        ]
      : [];

    const [
      trainingResult,
      raceResult,
      runnerResult,
      attendanceResult,
      trainingParticipantResult,
    ] = await Promise.all([...publicQueries, ...privateQueries]);

    const error =
      trainingResult?.error ||
      raceResult?.error ||
      runnerResult?.error ||
      attendanceResult?.error ||
      trainingParticipantResult?.error;

    if (error) {
      setMessage(error.message);
    } else {
      setTrainings(trainingResult?.data || []);
      setRaces(raceResult?.data || []);
      setRunners(runnerResult?.data || []);
      setAttendances(attendanceResult?.data || []);
      setTrainingParticipants(trainingParticipantResult?.data || []);
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

  async function saveMyRunner(event) {
    event.preventDefault();
    if (!user?.email || !supabase) return;

    const payload = {
      ...myRunnerForm,
      email: user.email.toLowerCase(),
      updated_at: new Date().toISOString(),
    };

    const result = myRunner
      ? await supabase.from("runners").update(payload).eq("id", myRunner.id)
      : await supabase.from("runners").insert(payload);

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    await loadDashboard();
    setMessage("러너 정보가 저장되었습니다.");
  }

  async function saveRunner(event) {
    event.preventDefault();
    if (!isAdmin || !supabase) return;

    const email = runnerForm.email.trim().toLowerCase();
    const duplicatedRunner = runners.find(
      (runner) =>
        runner.email?.toLowerCase() === email && runner.id !== editingRunnerId
    );

    if (duplicatedRunner) {
      setMessage(
        `${email} 계정은 이미 ${duplicatedRunner.name} 러너로 등록되어 있습니다. Google 계정 1개에는 러너 1명만 등록할 수 있습니다.`
      );
      return;
    }

    const payload = {
      ...runnerForm,
      email,
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

  async function saveTraining(event) {
    event.preventDefault();
    if (!isAdmin || !supabase) return;

    const payload = {
      title: trainingForm.title,
      training_date: trainingForm.training_date,
      training_time: trainingForm.training_time,
      location: trainingForm.location,
      memo: trainingForm.memo,
    };

    const result = editingTrainingId
      ? await supabase
          .from("training_schedules")
          .update(payload)
          .eq("id", editingTrainingId)
      : await supabase.from("training_schedules").insert(payload);

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    setTrainingForm(emptyTraining);
    setEditingTrainingId(null);
    await loadDashboard();
  }

  async function deleteTraining(id) {
    if (!isAdmin || !supabase) return;
    const { error } = await supabase
      .from("training_schedules")
      .delete()
      .eq("id", id);
    if (error) setMessage(error.message);
    await loadDashboard();
  }

  async function toggleTrainingParticipation(training) {
    if (!user?.email) {
      await signInWithGoogle();
      return;
    }

    const existing = trainingParticipants.find(
      (participant) =>
        participant.training_id === training.id &&
        participant.user_email?.toLowerCase() === userEmail
    );

    const result = existing
      ? await supabase
          .from("training_participants")
          .delete()
          .eq("id", existing.id)
      : await supabase.from("training_participants").insert({
          training_id: training.id,
          runner_id: myRunner?.id || null,
          user_email: user.email.toLowerCase(),
        });

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    await loadDashboard();
  }

  async function saveRace(event) {
    event.preventDefault();
    if (!isAdmin || !supabase) return;

    const payload = {
      title: raceForm.title,
      race_date: raceForm.race_date || null,
      location: raceForm.location,
    };

    const result = editingRaceId
      ? await supabase.from("races").update(payload).eq("id", editingRaceId)
      : await supabase.from("races").insert(payload);

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
    setRunnerForm(runnerToForm(runner));
  }

  function editRace(race) {
    setEditingRaceId(race.id);
    setRaceForm({
      title: race.title || "",
      race_date: race.race_date || "",
      location: race.location || "",
    });
  }

  function editTraining(training) {
    setEditingTrainingId(training.id);
    setTrainingForm({
      title: training.title || "",
      training_date: training.training_date || "",
      training_time: training.training_time || "",
      location: training.location || "",
      memo: training.memo || "",
    });
  }

  if (authLoading) {
    return <Shell centerText="페이지를 준비하는 중입니다." />;
  }

  if (!isSupabaseConfigured) {
    return (
      <Shell>
        <section className="login-panel">
          <ShieldCheck size={44} />
          <h1>Supabase 설정이 필요합니다</h1>
          <p>.env 파일에 Supabase URL과 anon key를 입력하면 서비스가 열립니다.</p>
        </section>
      </Shell>
    );
  }

  return (
    <Shell>
      <header className="topbar">
        <div>
          <span className="eyebrow">Byeokgaeja Runner Ops</span>
          <h1>벽깨자 훈련 보드</h1>
        </div>
        <div className="account">
          {user ? (
            <>
              <span>{user.email}</span>
              <strong>{isAdmin ? "관리자" : "러너"}</strong>
              <button className="icon-button" onClick={signOut} title="로그아웃">
                <LogOut size={18} />
              </button>
            </>
          ) : (
            <button className="secondary-action" onClick={signInWithGoogle}>
              <LogIn size={17} />
              러너 등록
            </button>
          )}
        </div>
      </header>

      {message && <div className="notice">{message}</div>}

      <main className="dashboard">
        <section className="training-hero">
          <div className="section-heading">
            <PanelTitle icon={<CalendarDays />} title="훈련 일정" />
            <span>참석은 Google 계정 확인 후 기록됩니다.</span>
          </div>
          <div className="training-list">
            {trainings.map((training) => (
              <TrainingCard
                key={training.id}
                training={training}
                isAdmin={isAdmin}
                joined={trainingParticipants.some(
                  (participant) =>
                    participant.training_id === training.id &&
                    participant.user_email?.toLowerCase() === userEmail
                )}
                participantCount={trainingParticipants.filter(
                  (participant) => participant.training_id === training.id
                ).length}
                onJoin={() => toggleTrainingParticipation(training)}
                onEdit={() => editTraining(training)}
                onDelete={() => deleteTraining(training.id)}
                hasUser={Boolean(user)}
              />
            ))}
            {!trainings.length && (
              <p className="empty-text">
                등록된 훈련 일정이 없습니다. 관리자가 일정을 등록하면 이곳에 가장
                먼저 표시됩니다.
              </p>
            )}
          </div>
        </section>

        {isAdmin && (
          <section className="ops-grid">
            <TrainingForm
              form={trainingForm}
              setForm={setTrainingForm}
              editingId={editingTrainingId}
              onSubmit={saveTraining}
              onCancel={() => {
                setTrainingForm(emptyTraining);
                setEditingTrainingId(null);
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
          <RunnerRegistrationPanel
            user={user}
            form={myRunnerForm}
            setForm={setMyRunnerForm}
            myRunner={myRunner}
            onLogin={signInWithGoogle}
            onSubmit={saveMyRunner}
          />

          <div className="panel">
            <PanelTitle icon={<Trophy />} title="대회 일정" />
            <div className="race-list">
              {races.map((race) => (
                <article className="race-item" key={race.id}>
                  <div>
                    <strong>{race.title}</strong>
                    <span>{race.race_date || "날짜 미정"}</span>
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

        {isAdmin && (
          <section className="panel subdued-panel">
            <PanelTitle icon={<ClipboardList />} title="러너 관리" />
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
            <div className="runner-list compact-list">
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
            </div>
          </section>
        )}

        <section className="summary-strip muted-summary">
          <Metric icon={<UserRound />} label="러너" value={visibleRunners.length} />
          <Metric
            icon={<CheckCircle2 />}
            label="월간 출석률"
            value={`${monthlyRate(attendances, myRunner?.id)}%`}
          />
          <Metric icon={<Trophy />} label="예정 대회" value={races.length} />
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

function TrainingCard({
  training,
  isAdmin,
  joined,
  participantCount,
  onJoin,
  onEdit,
  onDelete,
  hasUser,
}) {
  return (
    <article className={joined ? "training-card joined" : "training-card"}>
      <div className="training-main">
        <div>
          <span className="training-date">
            {formatDate(training.training_date)}
            {training.training_time ? ` · ${training.training_time}` : ""}
          </span>
          <h3>{training.title}</h3>
          {training.location && (
            <p>
              <MapPin size={15} />
              {training.location}
            </p>
          )}
          {training.memo && <small>{training.memo}</small>}
        </div>
        <div className="training-actions">
          {hasUser && (
            <span className="participant-count">
              <Users size={15} />
              {participantCount}
            </span>
          )}
          <button className={joined ? "secondary-action" : "primary-action"} onClick={onJoin}>
            {joined ? "참석 취소" : hasUser ? "참석하기" : "Google로 참석"}
          </button>
          {isAdmin && (
            <div className="row-actions">
              <button onClick={onEdit} title="훈련 수정">
                <Pencil size={15} />
              </button>
              <button onClick={onDelete} title="훈련 삭제">
                <Trash2 size={15} />
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function RunnerRegistrationPanel({ user, form, setForm, myRunner, onLogin, onSubmit }) {
  if (!user) {
    return (
      <section className="panel registration-panel">
        <PanelTitle icon={<UserRound />} title="러너 등록" />
        <p>
          러너 정보 저장과 훈련 참석 기록은 Google 계정 확인 후 사용할 수 있습니다.
        </p>
        <button className="primary-action" onClick={onLogin}>
          <LogIn size={18} />
          Google로 러너 등록
        </button>
      </section>
    );
  }

  return (
    <form className="panel form-panel registration-panel" onSubmit={onSubmit}>
      <PanelTitle icon={<UserRound />} title={myRunner ? "내 러너 정보" : "러너 등록"} />
      <div className="form-grid">
        <input
          required
          placeholder="이름"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
        <input value={user.email} disabled />
        <input
          placeholder="연락처"
          value={form.phone}
          onChange={(event) => setForm({ ...form, phone: event.target.value })}
        />
        <input
          placeholder="10km 기록"
          value={form.ten_k_record}
          onChange={(event) => setForm({ ...form, ten_k_record: event.target.value })}
        />
        <input
          placeholder="하프 기록"
          value={form.half_record}
          onChange={(event) => setForm({ ...form, half_record: event.target.value })}
        />
        <input
          placeholder="풀코스 기록"
          value={form.full_record}
          onChange={(event) => setForm({ ...form, full_record: event.target.value })}
        />
        <input
          placeholder="목표 대회"
          value={form.goal_race}
          onChange={(event) => setForm({ ...form, goal_race: event.target.value })}
        />
        <input
          placeholder="목표 기록"
          value={form.goal_record}
          onChange={(event) => setForm({ ...form, goal_record: event.target.value })}
        />
      </div>
      <label className="check-row">
        <input
          type="checkbox"
          checked={form.injured}
          onChange={(event) => setForm({ ...form, injured: event.target.checked })}
        />
        부상 있음
      </label>
      <textarea
        placeholder="메모"
        value={form.memo}
        onChange={(event) => setForm({ ...form, memo: event.target.value })}
      />
      <button className="primary-action" type="submit">
        {myRunner ? "내 정보 저장" : "러너 등록"}
      </button>
    </form>
  );
}

function TrainingForm({ form, setForm, editingId, onSubmit, onCancel }) {
  return (
    <form className="panel form-panel" onSubmit={onSubmit}>
      <PanelTitle icon={<CalendarDays />} title={editingId ? "훈련 수정" : "훈련 등록"} />
      <div className="form-grid">
        <input
          required
          placeholder="훈련명"
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
        />
        <input
          required
          type="date"
          value={form.training_date}
          onChange={(event) =>
            setForm({ ...form, training_date: event.target.value })
          }
        />
        <input
          placeholder="시간 예: 20:00"
          value={form.training_time}
          onChange={(event) =>
            setForm({ ...form, training_time: event.target.value })
          }
        />
        <input
          placeholder="장소"
          value={form.location}
          onChange={(event) => setForm({ ...form, location: event.target.value })}
        />
      </div>
      <textarea
        placeholder="메모"
        value={form.memo}
        onChange={(event) => setForm({ ...form, memo: event.target.value })}
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

function RunnerForm({ form, setForm, editingId, onSubmit, onCancel }) {
  return (
    <form className="admin-runner-form" onSubmit={onSubmit}>
      <div className="form-grid">
        <input
          required
          placeholder="이름"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
        <input
          required
          type="email"
          placeholder="Google 계정 이메일"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
        />
        <input
          placeholder="연락처"
          value={form.phone}
          onChange={(event) => setForm({ ...form, phone: event.target.value })}
        />
        <input
          placeholder="10km 기록"
          value={form.ten_k_record}
          onChange={(event) => setForm({ ...form, ten_k_record: event.target.value })}
        />
        <input
          placeholder="하프 기록"
          value={form.half_record}
          onChange={(event) => setForm({ ...form, half_record: event.target.value })}
        />
        <input
          placeholder="풀코스 기록"
          value={form.full_record}
          onChange={(event) => setForm({ ...form, full_record: event.target.value })}
        />
        <input
          placeholder="목표 대회"
          value={form.goal_race}
          onChange={(event) => setForm({ ...form, goal_race: event.target.value })}
        />
        <input
          placeholder="목표 기록"
          value={form.goal_record}
          onChange={(event) => setForm({ ...form, goal_record: event.target.value })}
        />
      </div>
      <label className="check-row">
        <input
          type="checkbox"
          checked={form.injured}
          onChange={(event) => setForm({ ...form, injured: event.target.checked })}
        />
        부상 있음
      </label>
      <textarea
        placeholder="메모"
        value={form.memo}
        onChange={(event) => setForm({ ...form, memo: event.target.value })}
      />
      <div className="button-row">
        <button className="primary-action" type="submit">
          {editingId ? "러너 수정" : "러너 추가"}
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
      <div className="race-form-grid">
        <input
          required
          placeholder="대회명"
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
        />
        <input
          type="date"
          value={form.race_date}
          onChange={(event) => setForm({ ...form, race_date: event.target.value })}
        />
        <input
          placeholder="장소"
          value={form.location}
          onChange={(event) => setForm({ ...form, location: event.target.value })}
        />
      </div>
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

function runnerToForm(runner) {
  return {
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
  };
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

function formatDate(value) {
  if (!value) return "날짜 미정";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${value}T00:00:00`));
}

export default App;
