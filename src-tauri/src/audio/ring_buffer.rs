use ringbuf::{
    traits::Split,
    HeapCons, HeapProd, HeapRb,
};

pub fn create_audio_ring_buffer(
    capacity: usize,
) -> (HeapProd<f32>, HeapCons<f32>) {
    let rb = HeapRb::<f32>::new(capacity);
    rb.split()
}
