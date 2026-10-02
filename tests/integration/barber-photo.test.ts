import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ from: vi.fn(), storage: { from: vi.fn() }, local: false }));
vi.mock('../../lib/supabase', () => ({
  supabase: mock, get shouldUseLocalFallback() { return mock.local; }, assertOperationalSupabase: vi.fn()
}));
import { listBarbers, uploadBarberPhoto } from '../../services/barberRepository';
import { getBarberPhotoUrl, validateBarberPhoto } from '../../services/barberPhoto';
import { normalizePublicBarberOptions } from '../../components/PublicBookingPage';

const tenant = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const barber = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const oldPath = `${tenant}/barbers/${barber}/old.jpg`;
const file = () => new File(['png'], 'photo.png', { type: 'image/png' });
let current: string | null;
let upload: ReturnType<typeof vi.fn>;
let remove: ReturnType<typeof vi.fn>;
let update: ReturnType<typeof vi.fn>;
let readsFail = false;
let writesFail = false;
let ambiguousWrite = false;
let filters: Array<[string, unknown]>;

beforeEach(() => {
  vi.clearAllMocks();
  mock.local = false;
  current = oldPath;
  readsFail = writesFail = ambiguousWrite = false;
  filters = [];
  upload = vi.fn().mockResolvedValue({ error: null });
  remove = vi.fn().mockResolvedValue({ error: null });
  mock.storage.from.mockReturnValue({ upload, remove, getPublicUrl: (path: string) => ({ data: { publicUrl: `https://storage.test/${path}` } }) });
  update = vi.fn((patch: { photo_path: string }) => {
    const q: any = {
      eq: vi.fn((key: string, value: unknown) => { filters.push([key, value]); return q; }),
      is: vi.fn((key: string, value: unknown) => { filters.push([key, value]); return q; }),
      select: vi.fn(() => q),
      single: vi.fn(async () => {
        if (!writesFail || ambiguousWrite) current = patch.photo_path;
        if (writesFail) return { error: { message: 'private SQL' }, data: null };
        return { error: null, data: { id: barber, name: 'Leo', active: true, barbershop_id: tenant, photo_path: current } };
      })
    };
    return q;
  });
  mock.from.mockImplementation((table: string) => {
    expect(table).toBe('barbers');
    const q: any = { update, select: vi.fn(() => q), eq: vi.fn(() => q),
      single: vi.fn(async () => ({ error: readsFail ? {} : null, data: readsFail ? null : { photo_path: current } })),
      order: vi.fn(() => ({ returns: vi.fn(async () => ({ error: null, data: [{ id: barber, name: 'Leo', active: true, barbershop_id: tenant, photo_path: current }] })) })) };
    return q;
  });
});

describe('barber photos', () => {
  it('uploads then persists then cleans the previous photo; reload and public projection retain ID and path', async () => {
    remove.mockImplementation(async () => {
      expect(current).not.toBe(oldPath);
      return { error: null };
    });
    const result = await uploadBarberPhoto(barber, tenant, file());
    expect(upload).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`^${tenant}/barbers/${barber}/[a-f0-9-]+\\.png$`)), expect.any(File), { upsert: false, contentType: 'image/png', cacheControl: '3600' });
    expect(filters).toEqual([['id', barber], ['barbershop_id', tenant], ['photo_path', oldPath]]);
    expect(result.photoPath).toBe(current);
    expect(remove).toHaveBeenCalledWith([oldPath]);
    const reloaded = await listBarbers(tenant);
    expect(reloaded[0]).toEqual(result);
    const options = normalizePublicBarberOptions([result, { ...result, id: tenant, photoPath: null }]);
    expect(options.map(b => [b.id, b.photoPath])).toEqual([[barber, current], [tenant, null]]);
    expect(getBarberPhotoUrl(result)).toBe(`https://storage.test/${current}`);
  });

  it('adds a first photo using a null compare-and-set and no old cleanup', async () => {
    current = null;
    await uploadBarberPhoto(barber, tenant, file());
    expect(filters).toContainEqual(['photo_path', null]);
    expect(remove).not.toHaveBeenCalled();
  });

  it('upload failure never updates the row or removes the old photo', async () => {
    upload.mockRejectedValue(new Error('network'));
    await expect(uploadBarberPhoto(barber, tenant, file())).rejects.toThrow('Não foi possível salvar');
    expect(update).not.toHaveBeenCalled();
    expect(current).toBe(oldPath);
    expect(remove).not.toHaveBeenCalledWith([oldPath]);
  });

  it('failed persistence cleans only the new object', async () => {
    writesFail = true;
    await expect(uploadBarberPhoto(barber, tenant, file())).rejects.toThrow('Não foi possível salvar');
    expect(current).toBe(oldPath);
    expect(remove).toHaveBeenCalledWith([upload.mock.calls[0][0]]);
  });

  it('cleanup failure does not obscure persistence failure or remove the old photo', async () => {
    writesFail = true;
    remove.mockRejectedValue(new Error('cleanup'));
    await expect(uploadBarberPhoto(barber, tenant, file())).rejects.toThrow('Não foi possível salvar');
    expect(current).toBe(oldPath);
  });

  it('successful replacement survives old cleanup failure', async () => {
    remove.mockRejectedValue(new Error('cleanup'));
    const result = await uploadBarberPhoto(barber, tenant, file());
    expect(result.photoPath).toBe(current);
    expect(current).not.toBe(oldPath);
  });

  it('lost persistence response never deletes the newly committed photo', async () => {
    writesFail = ambiguousWrite = true;
    await expect(uploadBarberPhoto(barber, tenant, file())).rejects.toThrow('Não foi possível salvar');
    expect(current).toBe(upload.mock.calls[0][0]);
    expect(remove).not.toHaveBeenCalled();
  });

  it('does not clean an object when its reference cannot be verified', async () => {
    upload.mockImplementation(async () => { readsFail = true; throw new Error('network'); });
    await expect(uploadBarberPhoto(barber, tenant, file())).rejects.toThrow();
    expect(remove).not.toHaveBeenCalled();
  });

  it('preserves JPEG extension and rejects SVG, empty, oversized and foreign paths', () => {
    expect(validateBarberPhoto(new File(['jpg'], 'fake.webp', { type: 'image/jpeg' }))).toBe('jpg');
    expect(validateBarberPhoto(new File(['webp'], 'image.webp', { type: 'image/webp' }))).toBe('webp');
    expect(() => validateBarberPhoto(new File(['svg'], 'x.svg', { type: 'image/svg+xml' }))).toThrow();
    expect(() => validateBarberPhoto(new File(['x'], 'x', { type: 'constructor' }))).toThrow();
    expect(() => validateBarberPhoto(new File([], 'x.png', { type: 'image/png' }))).toThrow();
    expect(() => validateBarberPhoto({ type: 'image/png', size: 5242881 } as File)).toThrow();
    expect(getBarberPhotoUrl({ id: tenant, barbershopId: tenant, photoPath: oldPath })).toBeNull();
    expect(getBarberPhotoUrl({ id: barber, barbershopId: tenant, photoPath: 'https://external.test/x.png' })).toBeNull();
  });

  it('local mode cannot upload and never acts as a remote failure fallback', async () => {
    mock.local = true;
    await expect(uploadBarberPhoto(barber, tenant, file())).rejects.toThrow('modo conectado');
    expect(mock.from).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  it('invalid file is rejected before any Storage or table request', async () => {
    await expect(uploadBarberPhoto(barber, tenant, new File(['svg'], 'x.svg', { type: 'image/svg+xml' }))).rejects.toThrow('PNG');
    expect(mock.from).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  it('stale compare-and-set cleans the loser upload without deleting the winner', async () => {
    const winningPath = `${tenant}/barbers/${barber}/winner.png`;
    upload.mockImplementation(async () => { current = winningPath; return { error: null }; });
    writesFail = true;
    await expect(uploadBarberPhoto(barber, tenant, file())).rejects.toThrow('Não foi possível salvar');
    expect(filters).toContainEqual(['photo_path', oldPath]);
    expect(current).toBe(winningPath);
    expect(remove).toHaveBeenCalledWith([upload.mock.calls[0][0]]);
    expect(remove).not.toHaveBeenCalledWith([winningPath]);
    expect(remove).not.toHaveBeenCalledWith([oldPath]);
  });
});
