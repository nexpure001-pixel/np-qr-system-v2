'use server';

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export async function login(formData: FormData) {
    const supabase = await createClient();

    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (!email || !password) {
        return { error: 'メールアドレスとパスワードを入力してください。' };
    }

    const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        console.error('Login Error:', error);
        return { error: 'ログインに失敗しました。メールアドレスかパスワードが間違っています。' };
    }

    return redirect('/admin');
}

export async function signOut() {
    const supabase = await createClient();
    await supabase.auth.signOut();
    return redirect('/admin/login');
}
