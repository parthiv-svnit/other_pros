import React, { useState, useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Sun, Moon, Plus, AlertTriangle, Trash2, Edit, Save, X, Calendar, CheckCircle, XCircle, Settings, ChevronLeft, ChevronRight, Dot } from 'lucide-react';

// --- Helper Functions ---
const formatTime12Hour = (timeString) => {
    if (!timeString) return '';
    const [hourString, minute] = timeString.split(":");
    const hour = +hourString % 24;
    const ampm = hour < 12 || hour === 24 ? "AM" : "PM";
    const formattedHour = hour % 12 || 12;
    return `${formattedHour}:${minute} ${ampm}`;
};

const getWeekDateRange = (weekOffset = 0) => {
    const today = new Date();
    const startOfWeek = new Date(new Date().setDate(today.getDate() - (today.getDay() + 6) % 7 + (weekOffset * 7)));
    const endOfWeek = new Date(new Date(startOfWeek).setDate(startOfWeek.getDate() + 4));

    const options = { month: 'short', day: 'numeric' };
    const yearOption = { year: 'numeric' };
    
    const start = startOfWeek.toLocaleDateString('en-US', options);
    const end = endOfWeek.toLocaleDateString('en-US', options);
    const year = endOfWeek.toLocaleDateString('en-US', yearOption);

    return `${start} - ${end}, ${year}`;
};


// --- Main App Component ---
const App = () => {
    // --- STATE MANAGEMENT ---
    const [subjects, setSubjects] = useState(() => JSON.parse(localStorage.getItem('attendance-subjects')) || []);
    const [timetable, setTimetable] = useState(() => JSON.parse(localStorage.getItem('attendance-timetable')) || {});
    const [timeSlots, setTimeSlots] = useState(() => JSON.parse(localStorage.getItem('attendance-timeSlots')) || [
        { id: 1, start: '09:00', end: '10:00' },
        { id: 2, start: '10:00', end: '11:00' },
    ]);
    const [attendanceRecords, setAttendanceRecords] = useState(() => JSON.parse(localStorage.getItem('attendance-records')) || {});
    const [isDarkMode, setIsDarkMode] = useState(() => JSON.parse(localStorage.getItem('dark-mode')) || false);
    const [selectedSubjectId, setSelectedSubjectId] = useState(null);
    const [view, setView] = useState('dashboard');
    const [isSlotModalOpen, setIsSlotModalOpen] = useState(false);
    const [isTimeManagerOpen, setIsTimeManagerOpen] = useState(false);
    const [modalData, setModalData] = useState(null);

    // --- EFFECTS ---
    useEffect(() => localStorage.setItem('attendance-subjects', JSON.stringify(subjects)), [subjects]);
    useEffect(() => localStorage.setItem('attendance-timetable', JSON.stringify(timetable)), [timetable]);
    useEffect(() => localStorage.setItem('attendance-timeSlots', JSON.stringify(timeSlots)), [timeSlots]);
    useEffect(() => localStorage.setItem('attendance-records', JSON.stringify(attendanceRecords)), [attendanceRecords]);
    useEffect(() => localStorage.setItem('dark-mode', JSON.stringify(isDarkMode)), [isDarkMode]);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', isDarkMode);
    }, [isDarkMode]);

    // --- DATA DERIVATION & CALCULATIONS ---
    const subjectStats = useMemo(() => {
        const stats = {};
        subjects.forEach(subject => {
            const relevantRecords = Object.values(attendanceRecords).filter(rec => rec.subjectId === subject.id);
            const attended = relevantRecords.filter(rec => rec.status === 'present').length;
            const total = relevantRecords.length;
            const percentage = total > 0 ? (attended / total) * 100 : 0;
            stats[subject.id] = { attended, total, percentage };
        });
        return stats;
    }, [subjects, attendanceRecords]);

    const overallAttendance = useMemo(() => {
        const totalAttended = Object.values(subjectStats).reduce((sum, stat) => sum + stat.attended, 0);
        const totalConducted = Object.values(subjectStats).reduce((sum, stat) => sum + stat.total, 0);
        const percentage = totalConducted > 0 ? (totalAttended / totalConducted) * 100 : 0;
        return { percentage, totalAttended, totalConducted };
    }, [subjectStats]);

    // --- HANDLER FUNCTIONS ---
    const addSubject = (name, threshold) => {
        const newSubject = { id: Date.now(), name, threshold: parseInt(threshold, 10) || 75 };
        setSubjects(prev => [...prev, newSubject]);
    };

    const updateSubjectDetails = (id, name, threshold) => {
        setSubjects(prev => prev.map(sub => sub.id === id ? { ...sub, name, threshold: parseInt(threshold, 10) } : sub));
    };

    const deleteSubject = (id) => {
        setSubjects(prev => prev.filter(sub => sub.id !== id));
        const newTimetable = { ...timetable };
        Object.keys(newTimetable).forEach(day => {
            newTimetable[day] = newTimetable[day].filter(slot => slot.subjectId !== id);
        });
        setTimetable(newTimetable);
        const newRecords = { ...attendanceRecords };
        Object.keys(newRecords).forEach(key => {
            if (newRecords[key].subjectId === id) delete newRecords[key];
        });
        setAttendanceRecords(newRecords);
        if (selectedSubjectId === id) setSelectedSubjectId(null);
    };

    const addTimetableEntry = (day, timeSlotId, subjectId) => {
        const timeSlot = timeSlots.find(ts => ts.id === timeSlotId);
        if (!timeSlot) return;
        const newEntry = { id: Date.now(), startTime: timeSlot.start, endTime: timeSlot.end, subjectId: parseInt(subjectId, 10), timeSlotId };
        setTimetable(prev => {
            const daySlots = prev[day] ? [...prev[day], newEntry] : [newEntry];
            daySlots.sort((a, b) => a.startTime.localeCompare(b.startTime));
            return { ...prev, [day]: daySlots };
        });
        setIsSlotModalOpen(false);
    };
    
    const updateTimetableEntry = (day, entryId, newSubjectId) => {
        setTimetable(prev => {
            const newDaySlots = prev[day].map(entry => 
                entry.id === entryId ? { ...entry, subjectId: parseInt(newSubjectId, 10) } : entry
            );
            return { ...prev, [day]: newDaySlots };
        });
        setIsSlotModalOpen(false);
    };

    const deleteTimetableEntry = (day, entryId) => {
        setTimetable(prev => ({ ...prev, [day]: prev[day].filter(entry => entry.id !== entryId) }));
    };
    
    const handleOpenSlotModal = (day, timeSlot, existingEntry = null) => {
        setModalData({ day, timeSlot, existingEntry });
        setIsSlotModalOpen(true);
    };
    
    const addCustomTimeSlot = (start, end) => {
        setTimeSlots(prev => [...prev, { id: Date.now(), start, end }].sort((a,b) => a.start.localeCompare(b.start)));
    };

    const deleteCustomTimeSlot = (id) => {
        setTimeSlots(prev => prev.filter(ts => ts.id !== id));
        const newTimetable = { ...timetable };
        Object.keys(newTimetable).forEach(day => {
            newTimetable[day] = newTimetable[day].filter(slot => slot.timeSlotId !== id);
        });
        setTimetable(newTimetable);
    };

    const markAttendance = (slot, date, status) => {
        const recordKey = `${date.toISOString().split('T')[0]}_${slot.id}`;
        setAttendanceRecords(prev => ({ ...prev, [recordKey]: { subjectId: slot.subjectId, status, date: date.toISOString().split('T')[0] } }));
    };

    const selectedSubject = subjects.find(s => s.id === selectedSubjectId);
    const selectedSubjectStat = selectedSubjectId ? subjectStats[selectedSubjectId] : null;

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-sans transition-colors duration-300">
            <Header isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />
            <main className="container mx-auto p-4 md:p-6">
                <div className="flex justify-center mb-6">
                    <div className="inline-flex rounded-lg shadow-sm">
                        <button onClick={() => setView('dashboard')} className={`px-6 py-2 text-sm font-medium rounded-l-lg transition-colors ${view === 'dashboard' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'}`}>Dashboard</button>
                        <button onClick={() => setView('timetable')} className={`px-6 py-2 text-sm font-medium rounded-r-lg transition-colors ${view === 'timetable' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'}`}>Timetable</button>
                    </div>
                </div>

                {view === 'dashboard' ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2">
                            <DashboardStats overall={overallAttendance} />
                            <AddSubjectForm onAdd={addSubject} />
                            <SubjectList subjects={subjects} subjectStats={subjectStats} onDelete={deleteSubject} onSelect={setSelectedSubjectId} selectedSubjectId={selectedSubjectId} />
                        </div>
                        <div className="lg:col-span-1">
                            {selectedSubject ? <SubjectDetail subject={selectedSubject} stats={selectedSubjectStat} onUpdateDetails={updateSubjectDetails} onClose={() => setSelectedSubjectId(null)} /> : <Placeholder text="Select a subject to see details." />}
                        </div>
                    </div>
                ) : (
                    <TimetableGrid timetable={timetable} subjects={subjects} onMarkAttendance={markAttendance} attendanceRecords={attendanceRecords} onOpenSlotModal={handleOpenSlotModal} timeSlots={timeSlots} onDeleteTimetableEntry={deleteTimetableEntry} onOpenTimeManager={() => setIsTimeManagerOpen(true)} />
                )}
            </main>
            {isSlotModalOpen && <SlotEditModal subjects={subjects} onAddEntry={addTimetableEntry} onUpdateEntry={updateTimetableEntry} onClose={() => setIsSlotModalOpen(false)} modalData={modalData} />}
            {isTimeManagerOpen && <TimeSlotManagerModal timeSlots={timeSlots} onAddTimeSlot={addCustomTimeSlot} onDeleteTimeSlot={deleteCustomTimeSlot} onClose={() => setIsTimeManagerOpen(false)} />}
        </div>
    );
};

// --- Reusable & Dashboard Components (Mostly unchanged) ---
const Header = ({ isDarkMode, setIsDarkMode }) => (
    <header className="bg-white dark:bg-gray-800 shadow-md sticky top-0 z-20">
        <div className="container mx-auto px-4 md:px-6 py-4 flex justify-between items-center">
            <h1 className="text-2xl md:text-3xl font-bold text-blue-600 dark:text-blue-400">Attendance Pro</h1>
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"><Sun className="dark:hidden" /><Moon className="hidden dark:block" /></button>
        </div>
    </header>
);

const Placeholder = ({ text }) => (
    <div className="sticky top-24 p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg h-[600px] flex flex-col items-center justify-center text-center">
        <h3 className="text-xl font-bold text-gray-600 dark:text-gray-400">No Selection</h3>
        <p className="text-gray-500 dark:text-gray-500 mt-2">{text}</p>
    </div>
);

const DashboardStats = ({ overall }) => {
    const overallColor = overall.percentage >= 75 ? 'text-green-500' : 'text-red-500';
    return (
        <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-lg">
            <h2 className="text-xl font-bold mb-2">Overall Summary</h2>
            <div className="flex justify-around items-center text-center">
                <div><p className="text-sm text-gray-500 dark:text-gray-400">Overall %</p><p className={`text-3xl font-extrabold ${overallColor}`}>{overall.percentage.toFixed(2)}%</p></div>
                <div><p className="text-sm text-gray-500 dark:text-gray-400">Total Attended</p><p className="text-3xl font-extrabold">{overall.totalAttended}</p></div>
                <div><p className="text-sm text-gray-500 dark:text-gray-400">Total Marked</p><p className="text-3xl font-extrabold">{overall.totalConducted}</p></div>
            </div>
        </div>
    );
};

const AddSubjectForm = ({ onAdd }) => {
    const [name, setName] = useState('');
    const [threshold, setThreshold] = useState('75');
    const [isOpen, setIsOpen] = useState(false);
    const handleSubmit = (e) => { e.preventDefault(); if (!name.trim()) return; onAdd(name, threshold); setName(''); setThreshold('75'); setIsOpen(false); };
    return (
        <div className="mb-6">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-center p-3 text-lg font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-800 transition-all duration-300 shadow-md"><Plus size={24} className="mr-2" /> Add New Subject</button>
            {isOpen && (<form onSubmit={handleSubmit} className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-lg animate-fade-in-down">
                <div className="mb-4"><label htmlFor="subjectName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject Name</label><input id="subjectName" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Advanced Mathematics" className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required /></div>
                <div className="mb-4"><label htmlFor="threshold" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Attendance Threshold (%)</label><input id="threshold" type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} placeholder="e.g., 75" className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" min="1" max="100" required /></div>
                <button type="submit" className="w-full p-2 text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors">Save Subject</button>
            </form>)}
        </div>
    );
};

const SubjectList = ({ subjects, subjectStats, onDelete, onSelect, selectedSubjectId }) => (
    <div className="space-y-4">{subjects.length > 0 ? subjects.map(subject => <SubjectItem key={subject.id} subject={subject} stats={subjectStats[subject.id]} onDelete={onDelete} onSelect={onSelect} isSelected={selectedSubjectId === subject.id} />) : <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-lg"><h3 className="text-lg font-semibold">No subjects yet!</h3><p className="text-gray-500 dark:text-gray-400">Click "Add New Subject" to get started.</p></div>}</div>
);

const SubjectItem = ({ subject, stats, onDelete, onSelect, isSelected }) => {
    const { id, name, threshold } = subject;
    const { attended, total, percentage } = stats || { attended: 0, total: 0, percentage: 0 };
    const getStatus = () => {
        if (total === 0) return { color: 'bg-gray-500', textColor: 'text-gray-500', darkTextColor: 'dark:text-gray-400', message: 'No classes marked' };
        if (percentage >= threshold) return { color: 'bg-green-500', textColor: 'text-green-500', darkTextColor: 'dark:text-green-400', message: 'Safe Zone' };
        if (percentage >= threshold - 5) return { color: 'bg-yellow-500', textColor: 'text-yellow-500', darkTextColor: 'dark:text-yellow-400', message: 'Nearing Threshold' };
        return { color: 'bg-red-500', textColor: 'text-red-500', darkTextColor: 'dark:text-red-400', message: 'Danger Zone' };
    };
    const status = getStatus();
    return (<div onClick={() => onSelect(id)} className={`p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-lg cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-[1.02] ${isSelected ? 'ring-4 ring-blue-500 dark:ring-blue-400' : 'ring-2 ring-transparent'}`}>
        <div className="flex justify-between items-start"><div><h3 className="text-lg font-bold">{name}</h3><p className={`text-sm font-semibold ${status.textColor} ${status.darkTextColor}`}>{status.message}</p></div><div className="text-right"><p className={`text-2xl font-extrabold ${status.textColor} ${status.darkTextColor}`}>{percentage.toFixed(1)}%</p><p className="text-xs text-gray-500 dark:text-gray-400">{attended} / {total} classes</p></div></div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mt-3"><div className={`${status.color} h-2.5 rounded-full`} style={{ width: `${percentage}%` }}></div></div>
        <div className="flex justify-end items-center mt-2"><button onClick={(e) => { e.stopPropagation(); onDelete(id); }} className="p-2 text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"><Trash2 size={20} /></button></div>
    </div>);
};

const SubjectDetail = ({ subject, stats, onUpdateDetails, onClose }) => {
    const { id, name, threshold } = subject;
    const { attended, total } = stats || { attended: 0, total: 0 };
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(name);
    const [editThreshold, setEditThreshold] = useState(threshold);
    const handleSave = () => { onUpdateDetails(id, editName, editThreshold); setIsEditing(false); };
    const chartData = [{ name: 'Attended', value: attended }, { name: 'Missed', value: total - attended }];
    const COLORS = ['#10B981', '#EF4444'];
    return (<div className="sticky top-24 p-4 md:p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg animate-fade-in">
        <div className="flex justify-between items-center mb-4">{isEditing ? <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="text-xl font-bold bg-transparent border-b-2 border-blue-500 focus:outline-none" /> : <h2 className="text-xl font-bold">{name}</h2>}<div className="flex items-center gap-2">{isEditing ? (<><button onClick={handleSave} className="p-2 text-green-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"><Save size={20}/></button><button onClick={() => setIsEditing(false)} className="p-2 text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"><X size={20}/></button></>) : (<button onClick={() => setIsEditing(true)} className="p-2 text-gray-500 hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"><Edit size={20}/></button>)}<button onClick={onClose} className="p-2 text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"><X size={24} /></button></div></div>
        {isEditing && (<div className="mb-4"><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Threshold (%)</label><input type="number" value={editThreshold} onChange={(e) => setEditThreshold(e.target.value)} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700" /></div>)}
        <div className="h-48 w-full mb-4"><ResponsiveContainer><PieChart><Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} fill="#8884d8" label>{chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></div>
        <p className="text-center text-gray-600 dark:text-gray-400">Note: Predictions are complex with date-based records and are not shown in this view.</p>
    </div>);
};

// --- Timetable Components ---
const TimetableGrid = ({ timetable, subjects, onOpenSlotModal, timeSlots, onOpenTimeManager, onDeleteTimetableEntry, onMarkAttendance, attendanceRecords }) => {
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const [isEditMode, setIsEditMode] = useState(false);
    const [weekOffset, setWeekOffset] = useState(0);

    const dayHeaders = useMemo(() => {
        const headers = [];
        const today = new Date();
        const startOfWeek = new Date(new Date().setDate(today.getDate() - (today.getDay() + 6) % 7 + (weekOffset * 7)));
        for (let i = 0; i < 5; i++) {
            const currentDate = new Date(startOfWeek);
            currentDate.setDate(startOfWeek.getDate() + i);
            headers.push({
                dayName: days[i],
                date: currentDate.getDate(),
                month: currentDate.toLocaleString('en-US', { month: 'short' })
            });
        }
        return headers;
    }, [weekOffset]);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold flex items-center"><Calendar className="mr-3 text-blue-500"/> Weekly Timetable</h2>
                <button onClick={() => setIsEditMode(!isEditMode)} className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold transition-colors ${isEditMode ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'}`}>
                    {isEditMode ? <><X size={16}/> Cancel</> : <><Edit size={16}/> Edit Timetable</>}
                </button>
            </div>
            
            <div className="flex justify-between items-center mb-4 bg-gray-100 dark:bg-gray-700/50 p-2 rounded-lg">
                <button onClick={() => setWeekOffset(weekOffset - 1)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"><ChevronLeft/></button>
                <div className="font-semibold text-center">
                    <p>{getWeekDateRange(weekOffset)}</p>
                    <button onClick={() => setWeekOffset(0)} className="text-xs text-blue-500 hover:underline">Go to Today</button>
                </div>
                <button onClick={() => setWeekOffset(weekOffset + 1)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"><ChevronRight/></button>
            </div>

            <div className="overflow-x-auto">
                <div className="grid gap-px bg-gray-200 dark:bg-gray-700" style={{ gridTemplateColumns: '120px repeat(5, 1fr)', minWidth: '800px' }}>
                    <div onClick={onOpenTimeManager} className="bg-gray-100 dark:bg-gray-800 p-2 text-center font-bold flex items-center justify-center cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                        <Settings size={16} className="mr-2"/> Time
                    </div>
                    {dayHeaders.map(header => (
                        <div key={header.dayName} className="bg-gray-100 dark:bg-gray-800 p-2 text-center font-bold">
                           <div className="text-sm font-normal text-gray-500">{header.date} {header.month}</div>
                           <div>{header.dayName}</div>
                        </div>
                    ))}
                    {timeSlots.map(ts => (
                        <React.Fragment key={ts.id}>
                            <div className="bg-gray-100 dark:bg-gray-800 p-2 text-center font-bold flex items-center justify-center">{formatTime12Hour(ts.start)} - {formatTime12Hour(ts.end)}</div>
                            {days.map((day, dayIndex) => {
                                const entry = (timetable[day] || []).find(s => s.timeSlotId === ts.id);
                                return <TimetableCell key={`${day}-${ts.id}`} entry={entry} timeSlot={ts} day={day} dayIndex={dayIndex} subjects={subjects} onMarkAttendance={onMarkAttendance} attendanceRecords={attendanceRecords} onOpenSlotModal={onOpenSlotModal} onDeleteTimetableEntry={onDeleteTimetableEntry} isEditMode={isEditMode} weekOffset={weekOffset} />;
                            })}
                        </React.Fragment>
                    ))}
                </div>
            </div>
        </div>
    );
};

const TimeSlotManagerModal = ({ timeSlots, onAddTimeSlot, onDeleteTimeSlot, onClose }) => {
    const [start, setStart] = useState('11:00');
    const [end, setEnd] = useState('12:00');

    const handleAdd = () => {
        if (start >= end) {
            alert("Start time must be before end time.");
            return;
        }
        onAddTimeSlot(start, end);
    };
    
    useEffect(() => {
        const handleEsc = (event) => {
            if (event.keyCode === 27) onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-lg transform transition-transform scale-95 animate-scale-in" onClick={e => e.stopPropagation()}>
                <h3 className="text-2xl font-bold mb-6 text-center">Manage Time Slots</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end mb-6 p-4 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
                    <div><label className="text-sm font-medium">Start Time</label><input type="time" value={start} onChange={e => setStart(e.target.value)} className="w-full p-2 mt-1 rounded-md bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600"/></div>
                    <div><label className="text-sm font-medium">End Time</label><input type="time" value={end} onChange={e => setEnd(e.target.value)} className="w-full p-2 mt-1 rounded-md bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600"/></div>
                    <button onClick={handleAdd} className="bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700 flex items-center justify-center h-10 shadow-md hover:shadow-lg transition-shadow"><Plus size={20} className="mr-1"/> Add Slot</button>
                </div>
                <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                    <h4 className="font-semibold text-lg">Current Slots:</h4>
                    {timeSlots.map(ts => (
                        <div key={ts.id} className="flex justify-between items-center bg-gray-50 dark:bg-gray-700 p-3 rounded-lg shadow-sm transition-all hover:shadow-md">
                            <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">{formatTime12Hour(ts.start)} - {formatTime12Hour(ts.end)}</span>
                            <button onClick={() => onDeleteTimeSlot(ts.id)} className="text-gray-400 hover:text-red-500 p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"><Trash2 size={16}/></button>
                        </div>
                    ))}
                </div>
                <div className="mt-6 text-center">
                    <button onClick={onClose} className="px-6 py-2 rounded-lg bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 font-semibold">Close</button>
                </div>
            </div>
        </div>
    );
};

const TimetableCell = ({ entry, timeSlot, day, dayIndex, subjects, onMarkAttendance, attendanceRecords, onOpenSlotModal, onDeleteTimetableEntry, isEditMode, weekOffset }) => {
    const now = new Date();
    const startOfWeek = new Date(new Date().setDate(now.getDate() - (now.getDay() + 6) % 7 + (weekOffset * 7)));
    const cellDate = new Date(startOfWeek.setDate(startOfWeek.getDate() + dayIndex));

    const subject = entry ? subjects.find(s => s.id === entry.subjectId) : null;
    const classDateTime = entry ? new Date(`${cellDate.toISOString().split('T')[0]}T${entry.endTime}`) : null;
    const isPast = classDateTime && classDateTime < new Date();
    const recordKey = entry ? `${cellDate.toISOString().split('T')[0]}_${entry.id}` : null;
    const record = recordKey ? attendanceRecords[recordKey] : null;

    const getStatusStyles = () => {
        if (!isPast && entry) return "bg-gray-200 dark:bg-gray-700 text-gray-400";
        if (isPast && !record) return "bg-yellow-100 dark:bg-yellow-900/50";
        if (record?.status === 'present') return "bg-green-100 dark:bg-green-900/50";
        if (record?.status === 'absent') return "bg-red-100 dark:bg-red-900/50";
        return "bg-white dark:bg-gray-900";
    };

    if (!entry) {
        return <div onClick={isEditMode ? () => onOpenSlotModal(day, timeSlot) : null} className={`min-h-[80px] flex items-center justify-center text-gray-400 transition-colors ${isEditMode ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800' : ''} ${getStatusStyles()}`}>{isEditMode && <Plus size={24}/>}</div>;
    }

    return (
        <div className={`p-2 min-h-[80px] text-xs relative group ${getStatusStyles()}`}>
             {isEditMode && (
                <div className="absolute top-1 right-1 flex items-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <button onClick={(e) => {e.stopPropagation(); onOpenSlotModal(day, timeSlot, entry)}} className="text-gray-500 hover:text-blue-500 p-1"><Edit size={14}/></button>
                    <button onClick={(e) => {e.stopPropagation(); onDeleteTimetableEntry(day, entry.id)}} className="text-gray-400 hover:text-red-500 p-1"><Trash2 size={14}/></button>
                </div>
            )}
            <p className="font-bold">{subject ? subject.name : "Error"}</p>
            <p className="text-gray-600 dark:text-gray-400">{formatTime12Hour(entry.startTime)} - {formatTime12Hour(entry.endTime)}</p>
            {isPast && !isEditMode && (
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-center gap-2">
                    <button title="Present" onClick={() => onMarkAttendance(entry, cellDate, 'present')} className={`p-1 rounded-full transition-colors ${record?.status === 'present' ? 'bg-green-500 text-white' : 'bg-gray-300 dark:bg-gray-600 hover:bg-green-400'}`}><CheckCircle size={14} /></button>
                    <button title="Absent" onClick={() => onMarkAttendance(entry, cellDate, 'absent')} className={`p-1 rounded-full transition-colors ${record?.status === 'absent' ? 'bg-red-500 text-white' : 'bg-gray-300 dark:bg-gray-600 hover:bg-red-400'}`}><XCircle size={14} /></button>
                </div>
            )}
        </div>
    );
};

const SlotEditModal = ({ subjects, onAddEntry, onUpdateEntry, onClose, modalData }) => {
    const [subjectId, setSubjectId] = useState("");

    useEffect(() => {
        if (modalData?.existingEntry) {
            setSubjectId(modalData.existingEntry.subjectId);
        } else {
            setSubjectId("");
        }
        const handleEsc = (event) => {
            if (event.keyCode === 27) onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [modalData, onClose]);

    if (!modalData) return null;

    const { day, timeSlot, existingEntry } = modalData;
    const isEditing = !!existingEntry;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!subjectId) {
            alert("Please select a subject.");
            return;
        }
        if (isEditing) {
            onUpdateEntry(day, existingEntry.id, subjectId);
        } else {
            onAddEntry(day, timeSlot.id, subjectId);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md animate-scale-in" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold mb-4">{isEditing ? 'Edit Class' : 'Add Class to Timetable'}</h3>
                <div className="mb-4">
                    <p><span className="font-semibold">Day:</span> {day}</p>
                    <p><span className="font-semibold">Time:</span> {formatTime12Hour(timeSlot.start)} - {formatTime12Hour(timeSlot.end)}</p>
                </div>
                <form onSubmit={handleSubmit}>
                    <label htmlFor="subject-select" className="block text-sm font-medium mb-2">Select Subject</label>
                    <select id="subject-select" value={subjectId} onChange={e => setSubjectId(e.target.value)} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500">
                        <option value="">-- Choose a subject --</option>
                        {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <div className="mt-6 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500">Cancel</button>
                        <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">{isEditing ? 'Save Changes' : 'Add Class'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default App;
