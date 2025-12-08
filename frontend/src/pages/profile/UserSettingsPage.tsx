import React, { ChangeEvent, FormEvent, useState } from "react";
import { AvatarUpload } from "../../components/profile/AvatarUpload";
import { SidebarNavigation } from "../../components/profile/SidebarNavigation";

type UserProfile = {
  username: string;
  email: string;
  phone: string;
  password: string;
  avatarUrl: string;
};

const MOCK_USER: UserProfile = {
  username: "john_doe",
  email: "john.doe@example.com",
  phone: "+1 234 567 3900",
  password: "password123",
  avatarUrl:
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
};

export const UserSettingsPage: React.FC = () => {
  const [formState, setFormState] = useState<UserProfile>(MOCK_USER);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleAvatarChange = (_file: File | null, preview: string) => {
    setFormState((prev) => ({ ...prev, avatarUrl: preview }));
  };

  const handleSave = (event: FormEvent) => {
    event.preventDefault();
    console.log("Updated user profile", formState);
  };

  return (
    <div className="min-h-screen bg-[#F4F6FB]">
      <div className="flex flex-col md:flex-row">
        <SidebarNavigation active="settings" />
        <main className="flex-1 bg-white px-6 py-10 md:px-12 lg:px-16">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-semibold text-[#111]">
              User Settings
            </h1>
            <p className="mt-2 text-base text-[#555]">
              Manage your profile, security, and contact preferences from one
              place.
            </p>

            <section className="mt-10 grid gap-10 lg:grid-cols-[160px_1fr]">
              <AvatarUpload
                avatarUrl={formState.avatarUrl}
                onChange={handleAvatarChange}
              />
              <form className="grid gap-6" onSubmit={handleSave}>
                <div className="flex flex-col gap-2">
                  <label
                    className="text-sm font-medium text-[#555]"
                    htmlFor="username"
                  >
                    Username
                  </label>
                  <input
                    id="username"
                    name="username"
                    value={formState.username}
                    onChange={handleInputChange}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-[#111] shadow-sm focus:border-[#3B82F6] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/30"
                    placeholder="john_doe"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label
                    className="text-sm font-medium text-[#555]"
                    htmlFor="email"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={formState.email}
                    onChange={handleInputChange}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-[#111] shadow-sm focus:border-[#3B82F6] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/30"
                    placeholder="john.doe@example.com"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label
                    className="text-sm font-medium text-[#555]"
                    htmlFor="phone"
                  >
                    Phone
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    value={formState.phone}
                    onChange={handleInputChange}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-[#111] shadow-sm focus:border-[#3B82F6] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/30"
                    placeholder="+1 234 567 3900"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label
                    className="text-sm font-medium text-[#555]"
                    htmlFor="password"
                  >
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    value={formState.password}
                    onChange={handleInputChange}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-[#111] shadow-sm focus:border-[#3B82F6] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/30"
                    placeholder="••••••••"
                  />
                </div>

                <div className="flex flex-col gap-3 pt-4">
                  <button
                    type="submit"
                    className="rounded-2xl bg-[#3B82F6] px-6 py-3 text-base font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-[#2563EB]"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
};

export default UserSettingsPage;
