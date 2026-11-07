'use client';

import React, { useState, useEffect } from 'react';
import { X, Building2, User, Briefcase, MapPin, Check, AlertCircle } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  uid: string;
  email: string;
  currentProfile: any;
  onProfileUpdated: (newProfile: any) => void;
}

export const DEPARTMENTS = [
  'Personal Lines',
  'Commercial Lines',
  'Risk Advisors and Sales',
  'Reception and Support Operations',
  'Administration and Operations',
];

export const OFFICE_LOCATIONS = [
  'Fishers (Headquarters)',
  'South Bend Office',
  'Columbus Office',
];

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  uid,
  email,
  currentProfile,
  onProfileUpdated,
}) => {
  const [displayName, setDisplayName] = useState(currentProfile?.displayName || '');
  const [department, setDepartment] = useState(currentProfile?.department || DEPARTMENTS[0]);
  const [roleTitle, setRoleTitle] = useState(currentProfile?.roleTitle || '');
  const [officeLocation, setOfficeLocation] = useState(currentProfile?.officeLocation || OFFICE_LOCATIONS[0]);
  const [prevProfile, setPrevProfile] = useState(currentProfile);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState(false);

  if (currentProfile !== prevProfile) {
    setPrevProfile(currentProfile);
    setDisplayName(currentProfile?.displayName || '');
    setDepartment(currentProfile?.department || DEPARTMENTS[0]);
    setRoleTitle(currentProfile?.roleTitle || '');
    setOfficeLocation(currentProfile?.officeLocation || OFFICE_LOCATIONS[0]);
  }

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!department || !roleTitle.trim()) {
      setErrorMsg('Please specify both your department and role title.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(false);

    const profileData = {
      uid,
      email,
      displayName: displayName.trim() || email.split('@')[0],
      department,
      roleTitle: roleTitle.trim(),
      officeLocation,
      updatedAt: new Date().toISOString(),
      ...(currentProfile?.createdAt ? {} : { createdAt: new Date().toISOString() }),
    };

    const path = `users/${uid}/profile/data`;
    try {
      await setDoc(doc(db, 'users', uid, 'profile', 'data'), profileData, { merge: true });
      onProfileUpdated(profileData);
      setSuccessMsg(true);
      setTimeout(() => {
        setSuccessMsg(false);
        onClose();
      }, 900);
    } catch (err: any) {
      console.error('Failed to save profile:', err);
      setErrorMsg('Error persisting profile to Firestore. Please try again.');
      try {
        handleFirestoreError(err, OperationType.WRITE, path);
      } catch (e) {
        // logged via handleFirestoreError
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center space-x-2">
            <User className="w-5 h-5 text-[#0096AF]" />
            <h3 className="font-bold text-slate-800 text-sm">PRM Employee Profile</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg flex items-center space-x-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>Profile updated successfully!</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Ingrid Pauline"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0096AF] focus:border-[#0096AF]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Corporate Email</label>
            <input
              type="text"
              value={email}
              disabled
              className="w-full text-xs px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">PRM Department</label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0096AF] focus:border-[#0096AF] bg-white"
            >
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Role Title</label>
            <input
              type="text"
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              placeholder="e.g. Senior Commercial Lines Account Manager"
              required
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0096AF] focus:border-[#0096AF]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Office Location</label>
            <select
              value={officeLocation}
              onChange={(e) => setOfficeLocation(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0096AF] focus:border-[#0096AF] bg-white"
            >
              {OFFICE_LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-[#0096AF] hover:bg-[#008197] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center space-x-1.5 disabled:opacity-50"
            >
              {saving ? <span>Saving...</span> : <span>Save Profile</span>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
