import { User, LogOut, Settings } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function UserProfile({ currentUser, currentUserName, onNavigateToChangePassword }) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleChangePassword = () => {
    setShowMenu(false);
    if (onNavigateToChangePassword) {
      onNavigateToChangePassword();
    }
  };

  if (!currentUser) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 p-1 rounded-full hover:bg-gray-50 transition-colors border border-gray-200 bg-white shadow-sm"
        title={currentUserName || currentUser}
      >
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <User className="w-5 h-5 text-primary" />
        </div>
      </button>

      {showMenu && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-xl border border-gray-100 p-2 z-50">
          <div className="px-3 py-2 border-b border-gray-100 mb-1 truncate text-xs text-gray-500 font-medium">
            {currentUserName || currentUser}
          </div>
          <button
            onClick={handleChangePassword}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors font-medium"
          >
            <Settings className="w-4 h-4 text-gray-400" />
            Update profile
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors font-bold"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
