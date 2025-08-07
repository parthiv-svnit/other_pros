import React, { useState, useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Sun, Moon, Plus, AlertTriangle, Trash2, Edit, Save, X } from 'lucide-react';

// Main App Component
const App = () => {
    // State for subjects, initialized from local storage or with a default example
    const [subjects, setSubjects] = useState(() => {
        try {
            const savedSubjects = localStorage.getItem('attendance-subjects');
            return savedSubjects ? JSON.parse(savedSubjects) : [{ id: 1, name: 'Example Subject', attended: 15, total: 20, threshold: 75 }];
        } catch (error) {
            console.error("Error parsing subjects from localStorage", error);
            return [{ id: 1, name: 'Example Subject', attended: 15, total: 20, threshold: 75 }];
        }
    });

    // State for dark mode, initialized from local storage or system preference
    const [isDarkMode, setIsDarkMode] = useState(() => {
        const savedMode = localStorage.getItem('dark-mode');
        return savedMode ? JSON.parse(savedMode) : window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    // State for the currently selected subject for detailed view
    const [selectedSubjectId, setSelectedSubjectId] = useState(null);

    // Effect to apply dark mode class to the body
    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('dark-mode', JSON.stringify(isDarkMode));
    }, [isDarkMode]);

    // Effect to save subjects to local storage whenever they change
    useEffect(() => {
        localStorage.setItem('attendance-subjects', JSON.stringify(subjects));
    }, [subjects]);

    // Function to add a new subject
    const addSubject = (name, threshold) => {
        const newSubject = {
            id: Date.now(),
            name,
            attended: 0,
            total: 0,
            threshold: parseInt(threshold, 10) || 75,
        };
        setSubjects([...subjects, newSubject]);
    };

    // Function to update a subject's attendance
    const updateAttendance = (id, attended, total) => {
        setSubjects(subjects.map(sub => sub.id === id ? { ...sub, attended, total } : sub));
    };
    
    // Function to update a subject's details (name, threshold)
    const updateSubjectDetails = (id, name, threshold) => {
         setSubjects(subjects.map(sub => sub.id === id ? { ...sub, name, threshold: parseInt(threshold, 10) } : sub));
    };

    // Function to delete a subject
    const deleteSubject = (id) => {
        setSubjects(subjects.filter(sub => sub.id !== id));
        if (selectedSubjectId === id) {
            setSelectedSubjectId(null);
        }
    };
    
    // Memoized calculation for overall attendance
    const overallAttendance = useMemo(() => {
        const totalAttended = subjects.reduce((sum, sub) => sum + sub.attended, 0);
        const totalConducted = subjects.reduce((sum, sub) => sum + sub.total, 0);
        if (totalConducted === 0) return { percentage: 0, totalAttended, totalConducted };
        const percentage = (totalAttended / totalConducted) * 100;
        return { percentage, totalAttended, totalConducted };
    }, [subjects]);

    const selectedSubject = subjects.find(s => s.id === selectedSubjectId);

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-sans transition-colors duration-300">
            <Header isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />
            <main className="container mx-auto p-4 md:p-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <DashboardStats overall={overallAttendance} />
                        <AddSubjectForm onAdd={addSubject} />
                        <SubjectList 
                            subjects={subjects} 
                            onUpdate={updateAttendance} 
                            onDelete={deleteSubject}
                            onSelect={setSelectedSubjectId}
                            selectedSubjectId={selectedSubjectId}
                        />
                    </div>
                    <div className="lg:col-span-1">
                        {selectedSubject ? (
                            <SubjectDetail 
                                subject={selectedSubject} 
                                onUpdate={updateAttendance}
                                onUpdateDetails={updateSubjectDetails}
                                onClose={() => setSelectedSubjectId(null)}
                            />
                        ) : (
                            <div className="sticky top-24 p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg h-[600px] flex flex-col items-center justify-center text-center">
                                <h3 className="text-xl font-bold text-gray-600 dark:text-gray-400">Select a Subject</h3>
                                <p className="text-gray-500 dark:text-gray-500 mt-2">Click on a subject from the list to see its detailed analysis, charts, and predictions.</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

// Header Component
const Header = ({ isDarkMode, setIsDarkMode }) => (
    <header className="bg-white dark:bg-gray-800 shadow-md sticky top-0 z-20">
        <div className="container mx-auto px-4 md:px-6 py-4 flex justify-between items-center">
            <h1 className="text-2xl md:text-3xl font-bold text-blue-600 dark:text-blue-400">Attendance Tracker</h1>
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
            </button>
        </div>
    </header>
);

// Dashboard Statistics Component
const DashboardStats = ({ overall }) => {
    const overallColor = overall.percentage >= 75 ? 'text-green-500' : 'text-red-500';
    return (
        <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-lg">
            <h2 className="text-xl font-bold mb-2">Overall Summary</h2>
            <div className="flex justify-around items-center text-center">
                <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Overall %</p>
                    <p className={`text-3xl font-extrabold ${overallColor}`}>{overall.percentage.toFixed(2)}%</p>
                </div>
                <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Attended</p>
                    <p className="text-3xl font-extrabold">{overall.totalAttended}</p>
                </div>
                <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Conducted</p>
                    <p className="text-3xl font-extrabold">{overall.totalConducted}</p>
                </div>
            </div>
        </div>
    );
};


// Form to Add a New Subject
const AddSubjectForm = ({ onAdd }) => {
    const [name, setName] = useState('');
    const [threshold, setThreshold] = useState('75');
    const [isOpen, setIsOpen] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onAdd(name, threshold);
        setName('');
        setThreshold('75');
        setIsOpen(false);
    };

    return (
        <div className="mb-6">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-center p-3 text-lg font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-800 transition-all duration-300 shadow-md"
            >
                <Plus size={24} className="mr-2" /> Add New Subject
            </button>
            {isOpen && (
                <form onSubmit={handleSubmit} className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-lg animate-fade-in-down">
                    <div className="mb-4">
                        <label htmlFor="subjectName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject Name</label>
                        <input
                            id="subjectName"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Advanced Mathematics"
                            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            required
                        />
                    </div>
                    <div className="mb-4">
                        <label htmlFor="threshold" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Attendance Threshold (%)</label>
                        <input
                            id="threshold"
                            type="number"
                            value={threshold}
                            onChange={(e) => setThreshold(e.target.value)}
                            placeholder="e.g., 75"
                            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            min="1"
                            max="100"
                            required
                        />
                    </div>
                    <button type="submit" className="w-full p-2 text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors">
                        Save Subject
                    </button>
                </form>
            )}
        </div>
    );
};

// List of all Subjects
const SubjectList = ({ subjects, onUpdate, onDelete, onSelect, selectedSubjectId }) => (
    <div className="space-y-4">
        {subjects.length > 0 ? subjects.map(subject => (
            <SubjectItem 
                key={subject.id} 
                subject={subject} 
                onUpdate={onUpdate} 
                onDelete={onDelete}
                onSelect={onSelect}
                isSelected={selectedSubjectId === subject.id}
            />
        )) : (
            <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-lg">
                <h3 className="text-lg font-semibold">No subjects yet!</h3>
                <p className="text-gray-500 dark:text-gray-400">Click "Add New Subject" to get started.</p>
            </div>
        )}
    </div>
);

// Individual Subject Item in the List
const SubjectItem = ({ subject, onUpdate, onDelete, onSelect, isSelected }) => {
    const { id, name, attended, total, threshold } = subject;
    const percentage = total > 0 ? (attended / total) * 100 : 0;

    const getStatus = () => {
        if (total === 0) return { color: 'bg-gray-500', textColor: 'text-gray-500', darkTextColor: 'dark:text-gray-400', message: 'No classes yet' };
        if (percentage >= threshold) return { color: 'bg-green-500', textColor: 'text-green-500', darkTextColor: 'dark:text-green-400', message: 'Safe Zone' };
        if (percentage >= threshold - 5) return { color: 'bg-yellow-500', textColor: 'text-yellow-500', darkTextColor: 'dark:text-yellow-400', message: 'Nearing Threshold' };
        return { color: 'bg-red-500', textColor: 'text-red-500', darkTextColor: 'dark:text-red-400', message: 'Danger Zone' };
    };
    
    const status = getStatus();

    const handlePresent = () => onUpdate(id, attended + 1, total + 1);
    const handleAbsent = () => onUpdate(id, attended, total + 1);

    return (
        <div 
            onClick={() => onSelect(id)}
            className={`p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-lg cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-[1.02] ${isSelected ? 'ring-4 ring-blue-500 dark:ring-blue-400' : 'ring-2 ring-transparent'}`}
        >
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-lg font-bold">{name}</h3>
                    <p className={`text-sm font-semibold ${status.textColor} ${status.darkTextColor}`}>{status.message}</p>
                </div>
                <div className="text-right">
                    <p className={`text-2xl font-extrabold ${status.textColor} ${status.darkTextColor}`}>{percentage.toFixed(1)}%</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{attended} / {total} classes</p>
                </div>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mt-3">
                <div className={`${status.color} h-2.5 rounded-full`} style={{ width: `${percentage}%` }}></div>
            </div>
            <div className="flex justify-between items-center mt-4">
                <div className="flex gap-2">
                    <button onClick={(e) => { e.stopPropagation(); handlePresent(); }} className="px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-transform transform hover:scale-105">Present</button>
                    <button onClick={(e) => { e.stopPropagation(); handleAbsent(); }} className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-transform transform hover:scale-105">Absent</button>
                </div>
                <button onClick={(e) => { e.stopPropagation(); onDelete(id); }} className="p-2 text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                    <Trash2 size={20} />
                </button>
            </div>
        </div>
    );
};

// Detailed View for a Single Subject
const SubjectDetail = ({ subject, onUpdate, onUpdateDetails, onClose }) => {
    const { id, name, attended, total, threshold } = subject;
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(name);
    const [editThreshold, setEditThreshold] = useState(threshold);

    const percentage = total > 0 ? (attended / total) * 100 : 0;
    
    const analysis = useMemo(() => {
        if (total === 0) return { safeSkips: 0, needed: 0, message: "No classes conducted yet." };
        
        const thresholdRatio = threshold / 100;
        
        if (percentage >= threshold) {
            const safeSkips = Math.floor((attended - thresholdRatio * total) / thresholdRatio);
            return { safeSkips, needed: 0, message: `You can safely skip the next ${safeSkips} class(es).` };
        } else {
            const needed = Math.ceil((thresholdRatio * total - attended) / (1 - thresholdRatio));
            return { safeSkips: 0, needed, message: `You must attend the next ${needed} class(es) to reach ${threshold}%.` };
        }
    }, [attended, total, threshold, percentage]);
    
    const prediction = useMemo(() => {
        const next5Attended = ((attended + 5) / (total + 5)) * 100;
        const next5Missed = (attended / (total + 5)) * 100;
        return { next5Attended, next5Missed };
    }, [attended, total]);

    const chartData = [
        { name: 'Attended', value: attended },
        { name: 'Missed', value: total - attended },
    ];
    const COLORS = ['#10B981', '#EF4444'];
    
    const handleSave = () => {
        onUpdateDetails(id, editName, editThreshold);
        setIsEditing(false);
    };

    return (
        <div className="sticky top-24 p-4 md:p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg animate-fade-in">
            <div className="flex justify-between items-center mb-4">
                 {isEditing ? (
                    <input 
                        type="text" 
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="text-xl font-bold bg-transparent border-b-2 border-blue-500 focus:outline-none"
                    />
                ) : (
                    <h2 className="text-xl font-bold">{name}</h2>
                )}
                <div className="flex items-center gap-2">
                    {isEditing ? (
                        <>
                            <button onClick={handleSave} className="p-2 text-green-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"><Save size={20}/></button>
                            <button onClick={() => setIsEditing(false)} className="p-2 text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"><X size={20}/></button>
                        </>
                    ) : (
                         <button onClick={() => setIsEditing(true)} className="p-2 text-gray-500 hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"><Edit size={20}/></button>
                    )}
                    <button onClick={onClose} className="p-2 text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                        <X size={24} />
                    </button>
                </div>
            </div>
            
            {isEditing && (
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Threshold (%)</label>
                    <input 
                        type="number" 
                        value={editThreshold}
                        onChange={(e) => setEditThreshold(e.target.value)}
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700"
                    />
                </div>
            )}

            <div className="h-48 w-full mb-4">
                <ResponsiveContainer>
                    <PieChart>
                        <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} fill="#8884d8" label>
                            {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            </div>

            <div className="space-y-4">
                <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-xl">
                    <h4 className="font-semibold flex items-center"><AlertTriangle size={18} className="mr-2 text-yellow-500" /> Status & Advice</h4>
                    <p className="text-gray-700 dark:text-gray-300">{analysis.message}</p>
                    <div className="flex justify-around text-center mt-2">
                        <div>
                            <p className="text-sm text-gray-500">Can Skip</p>
                            <p className="text-2xl font-bold text-green-500">{analysis.safeSkips}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Must Attend</p>
                            <p className="text-2xl font-bold text-red-500">{analysis.needed}</p>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-xl">
                    <h4 className="font-semibold">Future Predictions</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">After next 5 classes:</p>
                    <ul className="list-inside list-disc mt-2 text-gray-700 dark:text-gray-300">
                        <li>If you <span className="font-bold text-green-500">attend all</span>: {prediction.next5Attended.toFixed(1)}%</li>
                        <li>If you <span className="font-bold text-red-500">miss all</span>: {prediction.next5Missed.toFixed(1)}%</li>
                    </ul>
                </div>
                
                 <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-xl">
                    <h4 className="font-semibold mb-2">Manual Adjustment</h4>
                    <div className="flex items-center gap-4">
                        <div className="flex-1">
                            <label className="text-sm">Attended</label>
                            <input 
                                type="number"
                                value={attended}
                                onChange={(e) => onUpdate(id, parseInt(e.target.value) || 0, total)}
                                className="w-full p-2 mt-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900"
                            />
                        </div>
                         <div className="flex-1">
                            <label className="text-sm">Total</label>
                            <input 
                                type="number"
                                value={total}
                                onChange={(e) => onUpdate(id, attended, parseInt(e.target.value) || 0)}
                                className="w-full p-2 mt-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default App;
